import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-[44rem] space-y-4 py-12">
      <h1 className="h1">No such page</h1>
      <p className="dek">
        There is nothing at this address. Try the{" "}
        <Link href="/" className="tlink inline-block py-1 font-semibold text-ink">
          search
        </Link>{" "}
        or the{" "}
        <Link href="/results" className="tlink inline-block py-1 font-semibold text-ink">
          results
        </Link>
        .
      </p>
    </div>
  );
}
