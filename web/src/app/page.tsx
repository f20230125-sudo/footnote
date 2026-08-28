import { Search } from "@/components/Search";
import { loadSample } from "@/lib/sampleLoad";

// The page shown before anything is asked is computed from the site's own data
// files. This page uses no request data, so Next renders it once, at build.
export default function Home() {
  return <Search sample={loadSample()} />;
}
