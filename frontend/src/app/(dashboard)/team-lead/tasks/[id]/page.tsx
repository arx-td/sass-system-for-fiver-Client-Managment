'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Loader2 } from 'lucide-react';

export default function TeamLeadTaskRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const taskId = params.id as string;

  useEffect(() => {
    const findTaskAndRedirect = async () => {
      if (!token || !taskId) return;

      try {
        // Fetch all projects to find the one containing this task
        const projectsRes = await fetch('/api/v1/projects', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!projectsRes.ok) {
          setError('Failed to load projects');
          return;
        }

        const projectsData = await projectsRes.json();

        // Search through projects to find the task
        for (const project of projectsData.data || []) {
          const taskRes = await fetch(`/api/v1/projects/${project.id}/tasks/${taskId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (taskRes.ok) {
            // Found the task, redirect to the correct URL
            router.replace(`/team-lead/projects/${project.id}/tasks/${taskId}`);
            return;
          }
        }

        setError('Task not found');
      } catch (err) {
        console.error('Error finding task:', err);
        setError('Failed to find task');
      }
    };

    findTaskAndRedirect();
  }, [token, taskId, router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">{error}</p>
        <button
          onClick={() => router.push('/team-lead')}
          className="text-primary hover:underline"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-64 gap-2">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-muted-foreground">Loading task...</p>
    </div>
  );
}
