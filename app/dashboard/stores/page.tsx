import { redirect } from "next/navigation";

export default function DashboardStoresPage() {
  redirect("/?view=stores");
}
