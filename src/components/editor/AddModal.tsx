import { Modal } from '@/components/ui/Modal';
import { AddRelativeForm } from './AddRelativeForm';
import { useTreeStore } from '@/hooks/useTree';
import { useI18n } from '@/lib/i18n';

export function AddModal() {
  const tree = useTreeStore((s) => s.tree);
  const addingForMemberId = useTreeStore((s) => s.addingForMemberId);
  const setAddingFor = useTreeStore((s) => s.setAddingFor);
  const { strings } = useI18n();

  const member = tree?.members.find((m) => m.id === addingForMemberId);

  return (
    <Modal
      isOpen={!!member}
      onClose={() => setAddingFor(null)}
      title={
        member
          ? `${strings.addRelative.title} — ${member.name}`
          : strings.addRelative.title
      }
    >
      {member && (
        <AddRelativeForm memberId={member.id} memberName={member.name} />
      )}
    </Modal>
  );
}
