// User roles in the app.
export type Role = "admin" | "employee";

// Central list of sidebar menu items.
// `roles` controls which user types can see the item.
export type NavItem = {
  label: string;
  href: string;
  icon: string; // emoji for now; we can swap to real icons later
  roles: Role[];
};

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "🏠", roles: ["admin", "employee"] },
  { label: "Students", href: "/students", icon: "🎓", roles: ["admin", "employee"] },
  { label: "Users", href: "/users", icon: "👥", roles: ["admin"] },
];
