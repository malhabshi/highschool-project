import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WebinarPublic } from "@/components/webinar-public";
import { ROOM_CODE } from "@/lib/video-room";

export const metadata: Metadata = {
  title: "Masar Webinar",
};

// Public page — outside the (app) group, so no login is required.
export default async function PublicWebinarPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!ROOM_CODE.test(code)) notFound();
  return <WebinarPublic code={code} />;
}
