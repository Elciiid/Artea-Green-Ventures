import { redirect } from "next/navigation";

export default function PeopleIndexPage() {
  redirect("/admin/people/directory");
}
