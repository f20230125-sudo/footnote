import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-3 py-16 text-center">
      <p className="eyebrow">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">No such page</h1>
      <p className="text-[14px] text-muted">
        Try the{" "}
        <Link href="/" className="font-medium text-accent underline underline-offset-2">
          search
        </Link>{" "}
        or the{" "}
        <Link href="/results" className="font-medium text-accent underline underline-offset-2">
          results
        </Link>
        .
      </p>
    </div>
  );
}
