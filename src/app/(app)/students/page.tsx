import { StudentsTable } from "@/components/students-table";

export default function StudentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Students</h1>
        <p className="text-slate-500">
          Manage students through the study-abroad pipeline
        </p>
      </div>

      <StudentsTable />
    </div>
  );
}
