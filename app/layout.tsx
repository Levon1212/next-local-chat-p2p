export const metadata = {
  title: "P2P Local Chat (No Server Storage)",
  description: "Password-gated P2P chat using WebRTC data channels and IndexedDB.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
