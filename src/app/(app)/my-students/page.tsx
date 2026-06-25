import { MyStudents } from "@/components/my-students";

export default function MyStudentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Students</h1>
        <p className="text-slate-500">Students assigned to you</p>
      </div>

      <MyStudents />
    </div>
  );
}
