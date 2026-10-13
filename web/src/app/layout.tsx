import type { Metadata, Viewport } from "next";
import { Libre_Franklin, Red_Hat_Mono } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ThemeProvider } from "@/components/theme";
import { THEME_SCRIPT } from "@/components/themeScript";
import "./globals.css";

// Everything the site says is Libre Franklin (one variable file, weights 100 to 900).
// Red Hat Mono is used only for the text of a filing page exactly as extracted.
// Both are downloaded at build and served from this site: the content policy allows no other.
const franklin = Libre_Franklin({ variable: "--font-franklin", subsets: ["latin"], display: "swap" });
const verbatim = Red_Hat_Mono({
  variable: "--font-verbatim",
  subsets: ["latin"],
  display: "swap",
  fallback: ["ui-monospace", "Cascadia Mono", "Consolas", "monospace"],
});

const TITLE = "Footnote: the page behind the figure";
const DESCRIPTION =
  "Search real company filings and see which page holds the answer. Scored on FinanceBench: 150 questions, 360 filings, with every number measured and every limit stated.";

// On Vercel this is the site's public address, which link previews need.
const SITE = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3050";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: "%s · Footnote" },
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "Footnote" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3ecf0" },
    { media: "(prefers-color-scheme: dark)", color: "#251b23" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The script below sets data-theme before React loads, so the attribute
    // differs from what the server sent. That is expected.
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${franklin.variable} ${verbatim.variable} h-full font-sans antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-field focus:bg-ink focus:px-4 focus:text-[14px] focus:font-semibold focus:text-leaf"
          >
            Skip to the content
          </a>
          <Header />
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1128px] flex-1 px-5 pb-16 pt-8 sm:px-6 lg:pt-10">
            {children}
          </main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
