"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { ArrowLeft, Save, Plus, Trash2, Loader2 } from "lucide-react";

interface Profile {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  university: string;
  degree: string;
  graduationDate: string;
  gpa: string;
  workAuth: string;
  skills: string[];
}

interface ResumeSection {
  id: string;
  sectionType: string;
  label: string;
  latexContent: string;
  keywords: string[];
  priority: number;
  isActive: boolean;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sections, setSections] = useState<ResumeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/profile").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/resume-sections").then((r) => r.json()),
    ])
      .then(([p, s]) => {
        setProfile(
          p || {
            fullName: "",
            email: "",
            phone: "",
            linkedinUrl: "",
            githubUrl: "",
            portfolioUrl: "",
            university: "",
            degree: "",
            graduationDate: "",
            gpa: "",
            workAuth: "us_citizen",
            skills: [],
          }
        );
        setSections(s || []);
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);
    await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setSaving(false);
  }

  async function deleteSection(id: string) {
    await fetch(`/api/resume-sections/${id}`, { method: "DELETE" });
    setSections((s) => s.filter((sec) => sec.id !== id));
  }

  if (loading) {
    return (
      <main className="flex-1 w-full max-w-[1200px] mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64" />
      </main>
    );
  }

  return (
    <main className="flex-1 w-full max-w-[1200px] mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h2 className="text-lg font-semibold">Settings</h2>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Profile</CardTitle>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={saveProfile}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {profile && (
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["fullName", "Full Name"],
                  ["email", "Email"],
                  ["phone", "Phone"],
                  ["linkedinUrl", "LinkedIn URL"],
                  ["githubUrl", "GitHub URL"],
                  ["portfolioUrl", "Portfolio URL"],
                  ["university", "University"],
                  ["degree", "Degree"],
                  ["graduationDate", "Graduation Date"],
                  ["gpa", "GPA"],
                  ["workAuth", "Work Authorization"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={(profile[key] as string) || ""}
                    onChange={(e) =>
                      setProfile({ ...profile, [key]: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-sm bg-secondary rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              ))}
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs text-muted-foreground">
                  Skills (comma separated)
                </label>
                <input
                  type="text"
                  value={profile.skills.join(", ")}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      skills: e.target.value.split(",").map((s) => s.trim()),
                    })
                  }
                  className="w-full px-3 py-1.5 text-sm bg-secondary rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Resume Sections */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              Resume Sections ({sections.length})
            </CardTitle>
            <Button size="sm" variant="secondary" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Section
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No resume sections yet. Add your LaTeX blocks to get started.
            </p>
          ) : (
            sections.map((section) => (
              <div
                key={section.id}
                className="flex items-center justify-between p-2 rounded-md bg-secondary/50"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{section.label}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {section.sectionType}
                    </Badge>
                    {!section.isActive && (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-status-neutral"
                      >
                        inactive
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {section.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => deleteSection(section.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </main>
  );
}
