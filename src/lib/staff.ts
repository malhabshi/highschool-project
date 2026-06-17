import type { Role } from "@/lib/nav";

// Staff accounts. For now this is a fixed sample list used by the
// "Viewing as" switcher. Later it will come from the Users page / Firebase.
export type Staff = {
  id: string;
  name: string;
  role: Role;
};

export const staff: Staff[] = [
  { id: "admin", name: "Admin", role: "admin" },
  { id: "sara", name: "Sara", role: "employee" },
  { id: "ahmed", name: "Ahmed", role: "employee" },
  { id: "mariam", name: "Mariam", role: "employee" },
];

export function staffName(id: string) {
  return staff.find((s) => s.id === id)?.name ?? id;
}
