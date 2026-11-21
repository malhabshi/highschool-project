import { WebinarStudio } from "@/components/webinar-studio";

export default async function WebinarStudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WebinarStudio id={id} />;
}
