import { AppShell } from "@/components/app-shell";
import { ProfilePanel } from "@/components/profile/profile-panel";
import { SettingsPanel } from "@/components/settings/settings-panel";

export default function ProfilePage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <ProfilePanel />
        <div className="border-t border-paper-line pt-6">
          <SettingsPanel />
        </div>
      </div>
    </AppShell>
  );
}
