import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function BranchVerificationModal() {
  const { user, setUser } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueNote, setIssueNote] = useState('');

  // Check if verification is needed
  const { data: verificationStatus, isLoading } = useQuery({
    queryKey: ['branch-verification-status'],
    queryFn: async () => {
      const response = await api.get('/branch-assignments/me/branch-verification-status');
      return response.data;
    },
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  // Verify branch mutation
  const verifyMutation = useMutation({
    mutationFn: (data: { confirmed: boolean; note?: string }) =>
      api.post('/branch-assignments/me/verify-branch', data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['branch-verification-status'] });
      if (variables.confirmed) {
        toast({
          title: 'Branch verified',
          description: `You are now working at ${response.data.branch_name}`,
        });
        // Update user state to clear verification flag
        if (user) {
          setUser({ ...user, branch_verification_required: false });
        }
      } else {
        toast({
          title: 'Issue reported',
          description: 'Your administrator has been notified.',
          variant: 'default',
        });
      }
      setShowIssueForm(false);
      setIssueNote('');
    },
    onError: () => {
      toast({ title: 'Failed to verify branch', variant: 'destructive' });
    },
  });

  const handleConfirm = () => {
    verifyMutation.mutate({ confirmed: true });
  };

  const handleReportIssue = () => {
    if (!issueNote.trim()) {
      toast({ title: 'Please provide a reason', variant: 'destructive' });
      return;
    }
    verifyMutation.mutate({ confirmed: false, note: issueNote });
  };

  // Don't show if loading or no verification needed
  if (isLoading || !verificationStatus?.verification_required) {
    return null;
  }

  const assignment = verificationStatus.assignment;

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Building2 className="h-6 w-6 text-primary" />
            Branch Assignment Verification
          </DialogTitle>
          <DialogDescription className="text-base">
            Your branch assignment has been updated. Please verify you are at the correct location.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <h3 className="font-semibold text-lg mb-2">You have been assigned to:</h3>
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <p className="text-xl font-bold text-primary">{assignment?.branch_name}</p>
                <p className="text-sm text-muted-foreground">
                  Assigned by {assignment?.assigned_by_name} on{' '}
                  {assignment?.assigned_at ? new Date(assignment.assigned_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
            {assignment?.effective_from && (
              <p className="text-sm mt-2">
                <strong>Effective from:</strong>{' '}
                {new Date(assignment.effective_from).toLocaleDateString()}
              </p>
            )}
            {assignment?.notes && (
              <p className="text-sm mt-2 text-muted-foreground">
                <strong>Note:</strong> {assignment.notes}
              </p>
            )}
          </div>

          {!showIssueForm ? (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
              <strong>Security Check:</strong> Please confirm you are physically present at this branch 
              before continuing. This ensures all your transactions are recorded correctly.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                <strong>Report Issue:</strong> If you are not at the assigned branch, please explain why.
              </div>
              <div className="space-y-2">
                <Label>Why are you not at the assigned branch?</Label>
                <Textarea
                  value={issueNote}
                  onChange={(e) => setIssueNote(e.target.value)}
                  placeholder="e.g., I was not informed of this change, I am still at the previous branch, etc."
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {!showIssueForm ? (
            <>
              <Button
                variant="outline"
                onClick={() => setShowIssueForm(true)}
                className="w-full sm:w-auto"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                I'm not at this branch
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={verifyMutation.isPending}
                className="w-full sm:w-auto"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {verifyMutation.isPending ? 'Verifying...' : 'Yes, I am at this branch'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setShowIssueForm(false)}
                className="w-full sm:w-auto"
              >
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleReportIssue}
                disabled={verifyMutation.isPending || !issueNote.trim()}
                className="w-full sm:w-auto"
              >
                {verifyMutation.isPending ? 'Submitting...' : 'Submit Issue Report'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
