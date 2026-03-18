import Link from "next/link";
import {
  Users,
  Workflow,
  FileText,
  Zap,
  Clock,
  Plug,
  BarChart3,
  Shield,
} from "lucide-react";

const SETTINGS_SECTIONS = [
  {
    href: "/settings/users",
    icon: Users,
    label: "User Management",
    description: "Manage team members, roles, and permissions",
  },
  {
    href: "/settings/workflow",
    icon: Workflow,
    label: "Workflow Rules",
    description: "Configure automated workflow triggers and actions",
  },
  {
    href: "/settings/templates",
    icon: FileText,
    label: "Communication Templates",
    description: "Email and SMS templates with merge fields",
  },
  {
    href: "/settings/automations",
    icon: Clock,
    label: "Scheduled Automations",
    description: "Maturity reminders, payment alerts, and scheduled jobs",
  },
  {
    href: "/settings/integrations",
    icon: Plug,
    label: "Integrations",
    description: "Connect external services (email, SMS, payments, accounting)",
  },
  {
    href: "/settings/webhooks",
    icon: Zap,
    label: "Webhooks",
    description: "Send real-time event notifications to external systems",
  },
  {
    href: "/settings/reports",
    icon: BarChart3,
    label: "Scheduled Reports",
    description: "Automated report delivery via email on a schedule",
  },
  {
    href: "/settings/audit-log",
    icon: Shield,
    label: "Audit Log",
    description: "View all system activity and changes",
  },
];

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-stone-500 mt-1">
          Configure your organization and integrations
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {SETTINGS_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="rounded-lg border bg-white p-5 hover:bg-stone-50 transition-colors/50"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-[#EFF4F9] p-3">
                  <Icon className="h-5 w-5 text-[#1E3A5F]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{section.label}</h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {section.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
