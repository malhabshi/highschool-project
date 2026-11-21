import { notFound } from "next/navigation";
import { VideoCall } from "@/components/video-call";
import { ROOM_CODE } from "@/lib/video-room";

export default async function VideoRoomPage({
  params,
}: {
  params: Promise<{ room: string }>;
}) {
  const { room } = await params;
  if (!ROOM_CODE.test(room)) notFound();
  return <VideoCall roomId={room} />;
}
