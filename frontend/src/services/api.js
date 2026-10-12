const API_BASE_URL = "http://localhost:8000";
const BUSINESS_ID = 1;

export async function getDashboard() {
  const response = await fetch(
    `${API_BASE_URL}/businesses/${BUSINESS_ID}/dashboard`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch dashboard data");
  }

  return response.json();
}