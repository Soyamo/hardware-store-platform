from sqlalchemy import create_engine

DATABASE_URL = "postgresql+psycopg://postgres:password@localhost:5432/hardware_store_platform"

engine = create_engine(DATABASE_URL)