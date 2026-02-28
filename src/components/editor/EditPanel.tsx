import { useState } from 'react';
import { X as XIcon } from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { MemberForm } from './MemberForm';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useTreeStore } from '@/hooks/useTree';
import { useI18n, t } from '@/lib/i18n';
import {
  getParents,
  getChildren,
  getSpouse,
  getSiblings,
} from '@/lib/tree-utils';

export function EditPanel() {
  const tree = useTreeStore((s) => s.tree);
  const selectedMemberId = useTreeStore((s) => s.selectedMemberId);
  const isEditing = useTreeStore((s) => s.isEditing);
  const selectMember = useTreeStore((s) => s.selectMember);
  const setEditing = useTreeStore((s) => s.setEditing);
  const removeRelationship = useTreeStore((s) => s.removeRelationship);
  const { strings } = useI18n();

  const [removingRel, setRemovingRel] = useState<{
    id: string;
    fromName: string;
    toName: string;
    type: string;
  } | null>(null);

  const member = tree?.members.find((m) => m.id === selectedMemberId);
  const isOpen = isEditing && !!member;

  const handleClose = () => {
    setEditing(false);
    selectMember(null);
  };

  /** Find the relationship id between two members of a given type */
  const findRelId = (otherId: string, type: string): string | undefined => {
    if (!tree) return undefined;
    return tree.relationships.find(
      (r) =>
        r.type === type &&
        ((r.from === member!.id && r.to === otherId) ||
          (r.from === otherId && r.to === member!.id)),
    )?.id;
  };

  const handleRemoveRel = (
    otherId: string,
    otherName: string,
    type: string,
  ) => {
    const relId = findRelId(otherId, type);
    if (!relId) return;
    setRemovingRel({
      id: relId,
      fromName: member!.name,
      toName: otherName,
      type,
    });
  };

  const confirmRemoveRel = () => {
    if (removingRel) {
      removeRelationship(removingRel.id);
      setRemovingRel(null);
    }
  };

  if (!tree || !member) {
    return (
      <Panel isOpen={false} onClose={handleClose}>
        <></>
      </Panel>
    );
  }

  // Gather relationships for display
  const parents = getParents(member.id, tree);
  const children = getChildren(member.id, tree);
  const spouse = getSpouse(member.id, tree);
  const siblings = getSiblings(member.id, tree);

  // Relation type display map
  const relTypeLabel: Record<string, string> = {
    'parent-child': strings.legend.parentChild,
    spouse: strings.legend.spouseRel,
    sibling: strings.legend.siblingRel,
  };

  return (
    <Panel
      isOpen={isOpen}
      onClose={handleClose}
      title={strings.editor.editMember}
    >
      <div className="flex flex-col gap-5">
        {/* Member edit form */}
        <MemberForm member={member} />

        {/* Current relationships */}
        <div className="flex flex-col gap-4">
          <span className="text-[11px] font-medium text-cream/60 uppercase tracking-wider block">
            {strings.editor.relationships}
          </span>

          <div className="flex flex-col gap-3">
            {parents.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-[11px] text-cream/30 uppercase w-16 pt-1">
                  {strings.editor.parents}
                </span>
                {parents.map((p) => (
                  <span key={p.id} className="flex items-center gap-1 group">
                    <button
                      onClick={() => selectMember(p.id)}
                      className="text-xs text-sage-light hover:text-sage bg-sage/5 px-3 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      {p.name}
                    </button>
                    <button
                      onClick={() =>
                        handleRemoveRel(p.id, p.name, 'parent-child')
                      }
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-cream/30 hover:text-error transition-all cursor-pointer"
                      title={strings.editor.removeRelConfirmTitle}
                    >
                      <XIcon size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {spouse && (
              <div className="flex flex-wrap gap-2">
                <span className="text-[11px] text-cream/30 uppercase w-16 pt-1">
                  {strings.editor.spouse}
                </span>
                <span className="flex items-center gap-1 group">
                  <button
                    onClick={() => selectMember(spouse.id)}
                    className="text-xs text-[#d48a9e] hover:text-[#e8a0b4] bg-wine/5 px-3 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    {spouse.name}
                  </button>
                  <button
                    onClick={() =>
                      handleRemoveRel(spouse.id, spouse.name, 'spouse')
                    }
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-cream/30 hover:text-error transition-all cursor-pointer"
                    title={strings.editor.removeRelConfirmTitle}
                  >
                    <XIcon size={12} />
                  </button>
                </span>
              </div>
            )}

            {children.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-[11px] text-cream/30 uppercase w-16 pt-1">
                  {strings.editor.children}
                </span>
                {children.map((c) => (
                  <span key={c.id} className="flex items-center gap-1 group">
                    <button
                      onClick={() => selectMember(c.id)}
                      className="text-xs text-amber-light hover:text-amber bg-amber/5 px-3 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      {c.name}
                    </button>
                    <button
                      onClick={() =>
                        handleRemoveRel(c.id, c.name, 'parent-child')
                      }
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-cream/30 hover:text-error transition-all cursor-pointer"
                      title={strings.editor.removeRelConfirmTitle}
                    >
                      <XIcon size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {siblings.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-[11px] text-cream/30 uppercase w-16 pt-1">
                  {strings.editor.siblings}
                </span>
                {siblings.map((s) => (
                  <span key={s.id} className="flex items-center gap-1 group">
                    <button
                      onClick={() => selectMember(s.id)}
                      className="text-xs text-cream/60 hover:text-cream bg-cream/5 px-3 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      {s.name}
                    </button>
                    <button
                      onClick={() => handleRemoveRel(s.id, s.name, 'sibling')}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-cream/30 hover:text-error transition-all cursor-pointer"
                      title={strings.editor.removeRelConfirmTitle}
                    >
                      <XIcon size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {parents.length === 0 &&
              !spouse &&
              children.length === 0 &&
              siblings.length === 0 && (
                <p className="text-xs text-cream/20 italic">
                  {strings.editor.noRelationships}
                </p>
              )}
          </div>
        </div>
      </div>

      {/* Confirm remove relationship modal */}
      <ConfirmModal
        isOpen={!!removingRel}
        onClose={() => setRemovingRel(null)}
        onConfirm={confirmRemoveRel}
        title={strings.editor.removeRelConfirmTitle}
        message={
          removingRel
            ? t(strings.editor.removeRelConfirmMessage, {
                type: relTypeLabel[removingRel.type] ?? removingRel.type,
                from: removingRel.fromName,
                to: removingRel.toName,
              })
            : ''
        }
        variant="warning"
      />
    </Panel>
  );
}
