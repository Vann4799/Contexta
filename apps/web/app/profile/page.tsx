import { AppShell } from "@/components/app-shell";
import { ProfilePanel } from "@/components/profile/profile-panel";

export default function ProfilePage() {
  return (
    <AppShell title="Profile">
      <ProfilePanel />
    </AppShell>
  );
}
