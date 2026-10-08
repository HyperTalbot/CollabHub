// frontend/app/(app)/profile/[id]/page.tsx
'use client';

import { use } from "react";
import ProfilePage from "@/components/profile/ProfilePage";

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return <ProfilePage userId={id} />;
}