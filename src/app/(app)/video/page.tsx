import { VideoLobby } from "@/components/video-lobby";

export default function VideoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Video Call</h1>
        <p className="text-slate-500">Meet face to face with your team</p>
      </div>

      <VideoLobby />
    </div>
  );
}
