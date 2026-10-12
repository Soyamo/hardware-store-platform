import asyncio
from contextlib import asynccontextmanager

from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException, Query
from sqlalchemy import text
from typing import Optional, List
from pydantic import BaseModel

from database import engine


class OrderItemRequest(BaseModel):
    product_id: int
    quantity: float


class OrderRequest(BaseModel):
    customer_name: str
    phone: str
    items: List[OrderItemRequest]


class OrderStatusRequest(BaseModel):
    status: str

class ProductRequest(BaseModel):
    category_id: int
    sku: str
    name: str
    description: Optional[str] = None
    price: float
    unit_of_measure: str
    stock_quantity: float
    image_url: Optional[str] = None

class ProductUpdateRequest(BaseModel):
    category_id: int
    sku: str
    name: str
    description: Optional[str] = None
    price: float
    unit_of_measure: str
    image_url: Optional[str] = None

class CategoryRequest(BaseModel):
    name: str
    parent_id: Optional[int] = None

def release_order_reservations(connection, order_id: int):
    """
    Releases all inventory reservations belonging to an order.

    This function is used when an order is cancelled or expired.
    """

    items_result = connection.execute(
        text("""
            SELECT
                product_id,
                quantity
            FROM order_items
            WHERE order_id = :order_id
            ORDER BY product_id;
        """),
        {
            "order_id": order_id
        }
    )

    for item in items_result:

        product_result = connection.execute(
            text("""
                SELECT
                    reserved_quantity
                FROM products
                WHERE id = :product_id
                FOR UPDATE;
            """),
            {
                "product_id": item.product_id
            }
        )

        product = product_result.fetchone()

        if product is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Product {item.product_id} "
                    f"not found."
                )
            )

        if product.reserved_quantity < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Not enough reserved stock "
                    f"to release product {item.product_id}."
                )
            )

        connection.execute(
            text("""
                UPDATE products
                SET
                    reserved_quantity =
                        reserved_quantity - :quantity,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :product_id;
            """),
            {
                "product_id": item.product_id,
                "quantity": item.quantity
            }
        )

async def expiry_worker():
    while True:
        try:
            with engine.begin() as connection:

                orders_result = connection.execute(
                    text("""
                        SELECT
                            id,
                            status
                        FROM orders
                        WHERE status IN ('PENDING', 'CONFIRMED')
                          AND expires_at <= CURRENT_TIMESTAMP
                        ORDER BY id
                        FOR UPDATE;
                    """)
                )

                orders = orders_result.fetchall()

                for order in orders:

                    release_order_reservations(
                        connection,
                        order.id
                    )

                    connection.execute(
                        text("""
                            UPDATE orders
                            SET
                                status = 'EXPIRED',
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = :order_id;
                        """),
                        {
                            "order_id": order.id
                        }
                    )

                    print(
                        f"Order {order.id} automatically expired."
                    )

        except Exception as e:
            print(
                f"Expiry worker error: {e}"
            )

        # Check every 5 minutes
        await asyncio.sleep(300)


@asynccontextmanager
async def lifespan(app: FastAPI):

    task = asyncio.create_task(
        expiry_worker()
    )

    yield

    task.cancel()

    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"message": "Hardware Store API is running"}


@app.get("/test-db")
def test_database():
    with engine.connect() as connection:
        result = connection.execute(
            text("SELECT current_database()")
        )
        database_name = result.scalar()

    return {"database": database_name}


@app.get("/businesses/{business_id}/categories")
def get_categories(business_id: int):
    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    id,
                    name,
                    parent_id
                FROM categories
                WHERE business_id = :business_id
                ORDER BY name;
            """),
            {"business_id": business_id}
        )

        categories = []

        for row in result:
            categories.append({
                "id": row.id,
                "name": row.name,
                "parent_id": row.parent_id,
            })

    return categories

@app.post("/businesses/{business_id}/categories")
def create_category(
    business_id: int,
    category: CategoryRequest
):
    category_name = category.name.strip()

    if not category_name:
        raise HTTPException(
            status_code=400,
            detail="Category name cannot be empty."
        )

    with engine.begin() as connection:

        # Verify parent category if provided
        if category.parent_id is not None:
            parent_result = connection.execute(
                text("""
                    SELECT id
                    FROM categories
                    WHERE id = :parent_id
                      AND business_id = :business_id;
                """),
                {
                    "parent_id": category.parent_id,
                    "business_id": business_id
                }
            )

            parent = parent_result.fetchone()

            if parent is None:
                raise HTTPException(
                    status_code=404,
                    detail="Parent category not found."
                )

        # Prevent duplicate category names at the same level
        duplicate_result = connection.execute(
            text("""
                SELECT id
                FROM categories
                WHERE business_id = :business_id
                  AND name = :name
                  AND (
                      parent_id = :parent_id
                      OR (
                          parent_id IS NULL
                          AND :parent_id IS NULL
                      )
                  );
            """),
            {
                "business_id": business_id,
                "name": category_name,
                "parent_id": category.parent_id
            }
        )

        if duplicate_result.fetchone() is not None:
            raise HTTPException(
                status_code=409,
                detail="A category with this name already exists at this level."
            )

        # Create category
        result = connection.execute(
            text("""
                INSERT INTO categories (
                    business_id,
                    name,
                    parent_id
                )
                VALUES (
                    :business_id,
                    :name,
                    :parent_id
                )
                RETURNING id, business_id, name, parent_id;
            """),
            {
                "business_id": business_id,
                "name": category_name,
                "parent_id": category.parent_id
            }
        )

        new_category = result.fetchone()

    return {
        "message": "Category created successfully.",
        "category": {
            "id": new_category.id,
            "business_id": new_category.business_id,
            "name": new_category.name,
            "parent_id": new_category.parent_id
        }
    }


@app.get("/businesses/{business_id}/products")
def get_products(
    business_id: int,
    category_id: Optional[int] = None
):
    with engine.connect() as connection:

        query = """
            SELECT
                p.id,
                p.sku,
                p.name,
                p.description,
                p.price,
                p.unit_of_measure,
                p.stock_quantity,
                p.reserved_quantity,
                p.category_id,
                c.name AS category_name
            FROM products p
            JOIN categories c
                ON c.id = p.category_id
                AND c.business_id = p.business_id
            WHERE p.business_id = :business_id
              AND p.is_active = TRUE
        """

        parameters = {
            "business_id": business_id
        }

        if category_id is not None:
            query += """
                AND p.category_id = :category_id
            """
            parameters["category_id"] = category_id

        query += """
            ORDER BY p.name;
        """

        result = connection.execute(
            text(query),
            parameters
        )

        products = []

        for row in result:
            products.append({
                "id": row.id,
                "sku": row.sku,
                "name": row.name,
                "description": row.description,
                "price": float(row.price),
                "unit_of_measure": row.unit_of_measure,
                "stock_quantity": float(row.stock_quantity),
                "reserved_quantity": float(row.reserved_quantity),
                "category_id": row.category_id,
                "category_name": row.category_name,
            })

    return products

@app.get("/businesses/{business_id}/products/{product_id}")
def get_product(business_id: int, product_id: int):
    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    id,
                    category_id,
                    sku,
                    name,
                    description,
                    price,
                    unit_of_measure,
                    stock_quantity,
                    reserved_quantity,
                    image_url
                FROM products
                WHERE business_id = :business_id
                  AND id = :product_id
                  AND is_active = TRUE;
            """),
            {
                "business_id": business_id,
                "product_id": product_id
            }
        )

        row = result.fetchone()

        if row is None:
            return {"error": "Product not found"}

        return {
            "id": row.id,
            "category_id": row.category_id,
            "sku": row.sku,
            "name": row.name,
            "description": row.description,
            "price": float(row.price),
            "unit_of_measure": row.unit_of_measure,
            "stock_quantity": float(row.stock_quantity),
            "reserved_quantity": float(row.reserved_quantity),
            "available_quantity": float(
                row.stock_quantity - row.reserved_quantity
            ),
            "image_url": row.image_url,
        }

@app.post("/businesses/{business_id}/products")
def create_product(
    business_id: int,
    product: ProductRequest
):
    # Basic validation
    if product.price < 0:
        raise HTTPException(
            status_code=400,
            detail="Price cannot be negative."
        )

    if product.stock_quantity < 0:
        raise HTTPException(
            status_code=400,
            detail="Stock quantity cannot be negative."
        )

    if not product.sku.strip():
        raise HTTPException(
            status_code=400,
            detail="SKU cannot be empty."
        )

    if not product.name.strip():
        raise HTTPException(
            status_code=400,
            detail="Product name cannot be empty."
        )

    if not product.unit_of_measure.strip():
        raise HTTPException(
            status_code=400,
            detail="Unit of measure cannot be empty."
        )

    with engine.begin() as connection:

        # 1. Verify that the category belongs to this business
        category_result = connection.execute(
            text("""
                SELECT id
                FROM categories
                WHERE id = :category_id
                  AND business_id = :business_id;
            """),
            {
                "category_id": product.category_id,
                "business_id": business_id
            }
        )

        category = category_result.fetchone()

        if category is None:
            raise HTTPException(
                status_code=404,
                detail="Category not found for this business."
            )

        # 2. Check whether the SKU already exists
        sku_result = connection.execute(
            text("""
                SELECT id
                FROM products
                WHERE business_id = :business_id
                  AND sku = :sku;
            """),
            {
                "business_id": business_id,
                "sku": product.sku.strip()
            }
        )

        existing_product = sku_result.fetchone()

        if existing_product is not None:
            raise HTTPException(
                status_code=409,
                detail="A product with this SKU already exists."
            )

        # 3. Create the product
        product_result = connection.execute(
            text("""
                INSERT INTO products (
                    business_id,
                    category_id,
                    sku,
                    name,
                    description,
                    price,
                    unit_of_measure,
                    stock_quantity,
                    reserved_quantity,
                    image_url,
                    is_active
                )
                VALUES (
                    :business_id,
                    :category_id,
                    :sku,
                    :name,
                    :description,
                    :price,
                    :unit_of_measure,
                    :stock_quantity,
                    0,
                    :image_url,
                    TRUE
                )
                RETURNING
                    id,
                    business_id,
                    category_id,
                    sku,
                    name,
                    description,
                    price,
                    unit_of_measure,
                    stock_quantity,
                    reserved_quantity,
                    image_url,
                    is_active,
                    created_at,
                    updated_at;
            """),
            {
                "business_id": business_id,
                "category_id": product.category_id,
                "sku": product.sku.strip(),
                "name": product.name.strip(),
                "description": product.description,
                "price": product.price,
                "unit_of_measure": product.unit_of_measure.strip(),
                "stock_quantity": product.stock_quantity,
                "image_url": product.image_url
            }
        )

        new_product = product_result.fetchone()

    return {
        "message": "Product created successfully.",
        "product": {
            "id": new_product.id,
            "business_id": new_product.business_id,
            "category_id": new_product.category_id,
            "sku": new_product.sku,
            "name": new_product.name,
            "description": new_product.description,
            "price": float(new_product.price),
            "unit_of_measure": new_product.unit_of_measure,
            "stock_quantity": float(new_product.stock_quantity),
            "reserved_quantity": float(
                new_product.reserved_quantity
            ),
            "available_quantity": float(
                new_product.stock_quantity -
                new_product.reserved_quantity
            ),
            "image_url": new_product.image_url,
            "is_active": new_product.is_active,
            "created_at": new_product.created_at,
            "updated_at": new_product.updated_at
        }
    }

@app.put("/businesses/{business_id}/products/{product_id}")
def update_product(
    business_id: int,
    product_id: int,
    product: ProductUpdateRequest
):
    # Basic validation
    if product.price < 0:
        raise HTTPException(
            status_code=400,
            detail="Price cannot be negative."
        )

    if not product.sku.strip():
        raise HTTPException(
            status_code=400,
            detail="SKU cannot be empty."
        )

    if not product.name.strip():
        raise HTTPException(
            status_code=400,
            detail="Product name cannot be empty."
        )

    if not product.unit_of_measure.strip():
        raise HTTPException(
            status_code=400,
            detail="Unit of measure cannot be empty."
        )

    with engine.begin() as connection:

        # 1. Find the product and make sure it belongs
        #    to this business
        product_result = connection.execute(
            text("""
                SELECT
                    id,
                    business_id,
                    stock_quantity,
                    reserved_quantity
                FROM products
                WHERE id = :product_id
                  AND business_id = :business_id
                FOR UPDATE;
            """),
            {
                "product_id": product_id,
                "business_id": business_id
            }
        )

        existing_product = product_result.fetchone()

        if existing_product is None:
            raise HTTPException(
                status_code=404,
                detail="Product not found."
            )

        # 2. Verify that the category belongs to this business
        category_result = connection.execute(
            text("""
                SELECT id
                FROM categories
                WHERE id = :category_id
                  AND business_id = :business_id;
            """),
            {
                "category_id": product.category_id,
                "business_id": business_id
            }
        )

        category = category_result.fetchone()

        if category is None:
            raise HTTPException(
                status_code=404,
                detail="Category not found for this business."
            )

        # 3. Check whether another product already uses
        #    this SKU
        sku_result = connection.execute(
            text("""
                SELECT id
                FROM products
                WHERE business_id = :business_id
                  AND sku = :sku
                  AND id <> :product_id;
            """),
            {
                "business_id": business_id,
                "sku": product.sku.strip(),
                "product_id": product_id
            }
        )

        duplicate_product = sku_result.fetchone()

        if duplicate_product is not None:
            raise HTTPException(
                status_code=409,
                detail="A product with this SKU already exists."
            )

        # 4. Update the product information
        updated_result = connection.execute(
            text("""
                UPDATE products
                SET
                    category_id = :category_id,
                    sku = :sku,
                    name = :name,
                    description = :description,
                    price = :price,
                    unit_of_measure = :unit_of_measure,
                    image_url = :image_url,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :product_id
                  AND business_id = :business_id
                RETURNING
                    id,
                    business_id,
                    category_id,
                    sku,
                    name,
                    description,
                    price,
                    unit_of_measure,
                    stock_quantity,
                    reserved_quantity,
                    image_url,
                    is_active,
                    created_at,
                    updated_at;
            """),
            {
                "product_id": product_id,
                "business_id": business_id,
                "category_id": product.category_id,
                "sku": product.sku.strip(),
                "name": product.name.strip(),
                "description": product.description,
                "price": product.price,
                "unit_of_measure": product.unit_of_measure.strip(),
                "image_url": product.image_url
            }
        )

        updated_product = updated_result.fetchone()

    return {
        "message": "Product updated successfully.",
        "product": {
            "id": updated_product.id,
            "business_id": updated_product.business_id,
            "category_id": updated_product.category_id,
            "sku": updated_product.sku,
            "name": updated_product.name,
            "description": updated_product.description,
            "price": float(updated_product.price),
            "unit_of_measure": updated_product.unit_of_measure,
            "stock_quantity": float(
                updated_product.stock_quantity
            ),
            "reserved_quantity": float(
                updated_product.reserved_quantity
            ),
            "available_quantity": float(
                updated_product.stock_quantity -
                updated_product.reserved_quantity
            ),
            "image_url": updated_product.image_url,
            "is_active": updated_product.is_active,
            "created_at": updated_product.created_at,
            "updated_at": updated_product.updated_at
        }
    }

@app.post("/businesses/{business_id}/orders")
def create_order(business_id: int, order: OrderRequest):

    if not order.items:
        raise HTTPException(
            status_code=400,
            detail="Order must contain at least one item."
        )

    with engine.begin() as connection:

        # 1. Find or create the customer
        customer_result = connection.execute(
            text("""
                SELECT id
                FROM customers
                WHERE business_id = :business_id
                  AND phone = :phone
                LIMIT 1;
            """),
            {
                "business_id": business_id,
                "phone": order.phone
            }
        )

        customer = customer_result.fetchone()

        if customer:
            customer_id = customer.id

        else:
            customer_result = connection.execute(
                text("""
                    INSERT INTO customers (
                        business_id,
                        name,
                        phone
                    )
                    VALUES (
                        :business_id,
                        :name,
                        :phone
                    )
                    RETURNING id;
                """),
                {
                    "business_id": business_id,
                    "name": order.customer_name,
                    "phone": order.phone
                }
            )

            customer_id = customer_result.scalar()

        # 2. Create the order
        order_result = connection.execute(
            text("""
                INSERT INTO orders (
                    business_id,
                    customer_id,
                    status,
                    expires_at
                )
                VALUES (
                    :business_id,
                    :customer_id,
                    'PENDING',
                    CURRENT_TIMESTAMP + INTERVAL '2 days'
                )
                RETURNING id, status, expires_at;
            """),
            {
                "business_id": business_id,
                "customer_id": customer_id
            }
        )

        new_order = order_result.fetchone()
        order_id = new_order.id

        # 3. Process every product in the order
        for item in order.items:

            if item.quantity <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="Quantity must be greater than zero."
                )

            product_result = connection.execute(
                text("""
                    SELECT
                        id,
                        name,
                        price,
                        stock_quantity,
                        reserved_quantity
                    FROM products
                    WHERE id = :product_id
                      AND business_id = :business_id
                      AND is_active = TRUE
                    FOR UPDATE;
                """),
                {
                    "product_id": item.product_id,
                    "business_id": business_id
                }
            )

            product = product_result.fetchone()

            if product is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"Product {item.product_id} not found."
                )

            available_quantity = (
                product.stock_quantity -
                product.reserved_quantity
            )

            if item.quantity > available_quantity:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Not enough stock for {product.name}. "
                        f"Available: {available_quantity}"
                    )
                )

            # 4. Add product to order_items
            connection.execute(
                text("""
                    INSERT INTO order_items (
                        order_id,
                        product_id,
                        quantity,
                        unit_price
                    )
                    VALUES (
                        :order_id,
                        :product_id,
                        :quantity,
                        :unit_price
                    );
                """),
                {
                    "order_id": order_id,
                    "product_id": product.id,
                    "quantity": item.quantity,
                    "unit_price": product.price
                }
            )

            # 5. Reserve the stock
            connection.execute(
                text("""
                    UPDATE products
                    SET
                        reserved_quantity =
                            reserved_quantity + :quantity,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = :product_id;
                """),
                {
                    "product_id": product.id,
                    "quantity": item.quantity
                }
            )

    return {
        "message": "Order reserved successfully.",
        "order_id": order_id,
        "status": new_order.status,
        "expires_at": new_order.expires_at
    }


@app.patch("/businesses/{business_id}/orders/{order_id}/status")
def update_order_status(
    business_id: int,
    order_id: int,
    request: OrderStatusRequest
):
    new_status = request.status.upper()

    allowed_statuses = {
        "PENDING",
        "CONFIRMED",
        "READY",
        "COLLECTED",
        "CANCELLED",
        "EXPIRED"
    }

    if new_status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status: {new_status}"
        )

    with engine.begin() as connection:

        # 1. Get and lock the order
        order_result = connection.execute(
            text("""
                SELECT
                    id,
                    business_id,
                    status,
                    expires_at
                FROM orders
                WHERE id = :order_id
                    AND business_id = :business_id
                FOR UPDATE;
            """),
            {
                "order_id": order_id,
                "business_id": business_id
            }
        )

        order = order_result.fetchone()

        if order is None:
            raise HTTPException(
                status_code=404,
                detail="Order not found."
            )

        current_status = order.status

        # 2. Define valid status transitions
        valid_transitions = {
            "PENDING": {
                "CONFIRMED",
                "CANCELLED",
                "EXPIRED"
            },
            "CONFIRMED": {
                "READY",
                "CANCELLED",
                "EXPIRED"
            },
            "READY": {
                "COLLECTED"
            },
            "COLLECTED": set(),
            "CANCELLED": set(),
            "EXPIRED": set()
        }

        if new_status not in valid_transitions[current_status]:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Cannot change order from "
                    f"{current_status} to {new_status}."
                )
            )

        # 3. If EXPIRED, verify the expiry time
        if new_status == "EXPIRED":

            if order.expires_at is None:
                raise HTTPException(
                    status_code=400,
                    detail="Order does not have an expiry time."
                )

            expiry_check = connection.execute(
                text("""
                    SELECT CURRENT_TIMESTAMP >= :expires_at;
                """),
                {
                    "expires_at": order.expires_at
                }
            )

            has_expired = expiry_check.scalar()

            if not has_expired:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Order has not expired yet. "
                        f"Expires at: {order.expires_at}"
                    )
                )

        # 4. Release reservations when cancelled/expired
        if new_status in {"CANCELLED", "EXPIRED"}:
            release_order_reservations(
                connection,
                order_id
            )

        # 5. If collected, remove stock AND reservation
        elif new_status == "COLLECTED":

            items_result = connection.execute(
                text("""
                    SELECT
                        product_id,
                        quantity
                    FROM order_items
                    WHERE order_id = :order_id
                    ORDER BY product_id;
                """),
                {
                    "order_id": order_id
                }
            )

            for item in items_result:

                product_result = connection.execute(
                    text("""
                        SELECT
                            stock_quantity,
                            reserved_quantity
                        FROM products
                        WHERE id = :product_id
                        FOR UPDATE;
                    """),
                    {
                        "product_id": item.product_id
                    }
                )

                product = product_result.fetchone()

                if product is None:
                    raise HTTPException(
                        status_code=404,
                        detail=(
                            f"Product {item.product_id} "
                            f"not found."
                        )
                    )

                if product.stock_quantity < item.quantity:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Not enough physical stock "
                            f"for product {item.product_id}."
                        )
                    )

                if product.reserved_quantity < item.quantity:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Not enough reserved stock "
                            f"for product {item.product_id}."
                        )
                    )

                connection.execute(
                    text("""
                        UPDATE products
                        SET
                            stock_quantity =
                                stock_quantity - :quantity,
                            reserved_quantity =
                                reserved_quantity - :quantity,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = :product_id;
                    """),
                    {
                        "product_id": item.product_id,
                        "quantity": item.quantity
                    }
                )

        # 6. Update order status
        connection.execute(
            text("""
                UPDATE orders
                SET
                    status = :status,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :order_id;
            """),
            {
                "order_id": order_id,
                "status": new_status
            }
        )

    return {
        "message": "Order status updated successfully.",
        "order_id": order_id,
        "old_status": current_status,
        "new_status": new_status
    }


@app.post("/orders/expire")
def expire_orders():
    """
    Finds expired PENDING/CONFIRMED orders and automatically
    changes them to EXPIRED while releasing their reservations.
    """

    expired_orders = []

    with engine.begin() as connection:

        # Find orders that have actually expired
        orders_result = connection.execute(
            text("""
                SELECT
                    id,
                    status,
                    expires_at
                FROM orders
                WHERE status IN ('PENDING', 'CONFIRMED')
                  AND expires_at <= CURRENT_TIMESTAMP
                ORDER BY id
                FOR UPDATE;
            """)
        )

        orders = orders_result.fetchall()

        for order in orders:

            # Release the inventory reservation
            release_order_reservations(
                connection,
                order.id
            )

            # Mark order as expired
            connection.execute(
                text("""
                    UPDATE orders
                    SET
                        status = 'EXPIRED',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = :order_id;
                """),
                {
                    "order_id": order.id
                }
            )

            expired_orders.append({
                "order_id": order.id,
                "old_status": order.status,
                "new_status": "EXPIRED"
            })

    return {
        "message": "Expired orders processed successfully.",
        "expired_orders": expired_orders,
        "count": len(expired_orders)
    }

@app.get("/businesses/{business_id}/orders")
def get_orders(
    business_id: int,
    status: Optional[str] = Query(None)
):
    with engine.connect() as connection:
        result = connection.execute(
            text("""
                SELECT
                    o.id AS order_id,
                    c.name AS customer_name,
                    c.phone,
                    o.status,
                    o.created_at,
                    o.expires_at,
                    COALESCE(
                        SUM(oi.quantity * oi.unit_price),
                        0
                    ) AS total
                FROM orders o
                JOIN customers c
                    ON c.id = o.customer_id
                LEFT JOIN order_items oi
                    ON oi.order_id = o.id
                WHERE o.business_id = :business_id
                    AND (CAST(:status AS VARCHAR) IS NULL 
                    OR o.status = CAST(:status AS VARCHAR))
                GROUP BY
                    o.id,
                    c.name,
                    c.phone,
                    o.status,
                    o.created_at,
                    o.expires_at
                ORDER BY o.created_at DESC;
            """),
            {
                "business_id": business_id,
                "status": status
            }
        )

        orders = []

        for row in result:
            orders.append({
                "order_id": row.order_id,
                "customer_name": row.customer_name,
                "phone": row.phone,
                "status": row.status,
                "created_at": row.created_at,
                "expires_at": row.expires_at,
                "total": float(row.total)
            })

    return orders

@app.get("/businesses/{business_id}/orders/{order_id}")
def get_order_details(
    business_id: int,
    order_id: int
):
    with engine.connect() as connection:

        # 1. Get the order and verify it belongs to this business
        order_result = connection.execute(
            text("""
                SELECT
                    o.id AS order_id,
                    c.name AS customer_name,
                    c.phone,
                    o.status,
                    o.created_at,
                    o.expires_at
                FROM orders o
                JOIN customers c
                    ON c.id = o.customer_id
                WHERE o.id = :order_id
                  AND o.business_id = :business_id;
            """),
            {
                "order_id": order_id,
                "business_id": business_id
            }
        )

        order = order_result.fetchone()

        if order is None:
            raise HTTPException(
                status_code=404,
                detail="Order not found."
            )

        # 2. Get all products belonging to the order
        items_result = connection.execute(
            text("""
                SELECT
                    oi.product_id,
                    p.name AS product_name,
                    oi.quantity,
                    oi.unit_price,
                    (oi.quantity * oi.unit_price) AS subtotal
                FROM order_items oi
                JOIN products p
                    ON p.id = oi.product_id
                WHERE oi.order_id = :order_id
                ORDER BY oi.id;
            """),
            {
                "order_id": order_id
            }
        )

        items = []
        total = 0

        for item in items_result:
            subtotal = float(item.subtotal)
            total += subtotal

            items.append({
                "product_id": item.product_id,
                "product_name": item.product_name,
                "quantity": float(item.quantity),
                "unit_price": float(item.unit_price),
                "subtotal": subtotal
            })

    return {
        "order_id": order.order_id,
        "customer_name": order.customer_name,
        "phone": order.phone,
        "status": order.status,
        "created_at": order.created_at,
        "expires_at": order.expires_at,
        "total": total,
        "items": items
    }

@app.get("/businesses/{business_id}/dashboard")
def get_dashboard(business_id: int):
    with engine.connect() as connection:

        # 1. Count current orders by status
        status_result = connection.execute(
            text("""
                SELECT
                    status,
                    COUNT(*) AS count
                FROM orders
                WHERE business_id = :business_id
                GROUP BY status;
            """),
            {
                "business_id": business_id
            }
        )

        status_counts = {
            "PENDING": 0,
            "CONFIRMED": 0,
            "READY": 0,
            "COLLECTED": 0,
            "CANCELLED": 0,
            "EXPIRED": 0
        }

        for row in status_result:
            status_counts[row.status] = row.count

        # 2. Count orders collected today
        collected_result = connection.execute(
            text("""
                SELECT COUNT(*)
                FROM orders
                WHERE business_id = :business_id
                  AND status = 'COLLECTED'
                  AND updated_at >= CURRENT_DATE;
            """),
            {
                "business_id": business_id
            }
        )

        collected_today = collected_result.scalar()

        # 3. Count cancelled orders today
        cancelled_result = connection.execute(
            text("""
                SELECT COUNT(*)
                FROM orders
                WHERE business_id = :business_id
                  AND status = 'CANCELLED'
                  AND updated_at >= CURRENT_DATE;
            """),
            {
                "business_id": business_id
            }
        )

        cancelled_today = cancelled_result.scalar()

        # 4. Get the 10 most recent orders
        recent_result = connection.execute(
            text("""
                SELECT
                    o.id AS order_id,
                    c.name AS customer_name,
                    c.phone,
                    o.status,
                    o.created_at,
                    o.expires_at,
                    COALESCE(
                        SUM(oi.quantity * oi.unit_price),
                        0
                    ) AS total
                FROM orders o
                JOIN customers c
                    ON c.id = o.customer_id
                LEFT JOIN order_items oi
                    ON oi.order_id = o.id
                WHERE o.business_id = :business_id
                GROUP BY
                    o.id,
                    c.name,
                    c.phone,
                    o.status,
                    o.created_at,
                    o.expires_at
                ORDER BY o.created_at DESC
                LIMIT 10;
            """),
            {
                "business_id": business_id
            }
        )

        recent_orders = []

        for row in recent_result:
            recent_orders.append({
                "order_id": row.order_id,
                "customer_name": row.customer_name,
                "phone": row.phone,
                "status": row.status,
                "created_at": row.created_at,
                "expires_at": row.expires_at,
                "total": float(row.total)
            })

    return {
        "pending_orders": status_counts["PENDING"],
        "confirmed_orders": status_counts["CONFIRMED"],
        "ready_orders": status_counts["READY"],
        "collected_orders": status_counts["COLLECTED"],
        "cancelled_orders": status_counts["CANCELLED"],
        "expired_orders": status_counts["EXPIRED"],
        "collected_today": collected_today,
        "cancelled_today": cancelled_today,
        "recent_orders": recent_orders
    }