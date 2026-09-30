import { redirect } from "next/navigation";

export default function DashboardProductsPage() {
  redirect("/?view=stores");
}
