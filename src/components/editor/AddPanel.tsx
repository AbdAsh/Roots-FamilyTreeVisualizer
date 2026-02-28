import { Panel } from '@/components/ui/Panel';
import { AddRelativeForm } from './AddRelativeForm';
import { useTreeStore } from '@/hooks/useTree';
import { useI18n } from '@/lib/i18n';

export function AddPanel() {
  const tree = useTreeStore((s) => s.tree);
  const addingForMemberId = useTreeStore((s) => s.addingForMemberId);
  const setAddingFor = useTreeStore((s) => s.setAddingFor);
  const { strings } = useI18n();

  const member = tree?.members.find((m) => m.id === addingForMemberId);

  return (
    <Panel
      isOpen={!!member}
      onClose={() => setAddingFor(null)}
      title={
        member
          ? `${strings.addRelative.title} — ${member.name}`
          : strings.addRelative.title
      }
    >
      {member && (
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <AddRelativeForm memberId={member.id} memberName={member.name} />
        </div>
      )}
    </Panel>
  );
}
