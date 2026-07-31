import { redirect } from "next/navigation";

export default function PeopleRolesRedirect() {
  redirect("/admin/people/directory");
}
