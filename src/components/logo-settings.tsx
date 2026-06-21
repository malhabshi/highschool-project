"use client";

import { useLogo } from "@/lib/branding";

export function LogoSettings() {
  const { logo, setLogo, clearLogo } = useLogo();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      e.target.value = "";
      return;
    }
    if (file.size > 1_000_000) {
      alert("Please choose an image under 1 MB.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result));
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-800">Logo</h2>
      <p className="mb-3 text-sm text-slate-500">
        Shown at the top of the app and on the sign-in page. The same logo
        applies to everyone.
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-16 w-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Current logo" className="max-h-12 w-auto" />
          ) : (
            <span className="text-sm text-slate-400">No logo</span>
          )}
        </div>

        <label className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
          {logo ? "Change logo" : "Upload logo"}
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
        </label>

        {logo && (
          <button
            onClick={() => {
              if (confirm("Remove the logo?")) clearLogo();
            }}
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-600 hover:text-white"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
