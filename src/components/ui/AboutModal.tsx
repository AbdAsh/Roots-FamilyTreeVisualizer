/**
 * About modal — plain-language explanation of how Roots works.
 *
 * Triggered by the "About" button in the header. Uses the base {@link Modal} component.
 *
 * @module AboutModal
 */
import { Modal } from '@/components/ui/Modal';
import { useI18n } from '@/lib/i18n';
import {
  TreePine,
  Link2,
  Lock,
  Share2,
  Download,
  Languages,
  Github,
  Linkedin,
  Globe,
  ExternalLink,
} from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** A small section card used inside the modal. */
function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 w-7 h-7 rounded-md border border-charcoal-lighter flex items-center justify-center text-amber">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-base font-medium text-cream mb-1 tracking-tight">
            {title}
          </h3>
          <div className="text-xs text-cream-dark leading-relaxed">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  const { strings } = useI18n();
  const about = strings.about;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={about.title}>
      <div className="flex flex-col gap-5 max-h-[70vh] overflow-y-auto pr-1 -mr-1 custom-scrollbar">
        {/* What is Roots */}
        <Section icon={<TreePine size={14} />} title={about.whatTitle}>
          <p>{about.whatBody}</p>
        </Section>

        {/* The link is the database */}
        <Section icon={<Link2 size={14} />} title={about.linkTitle}>
          <p>{about.linkBody}</p>
        </Section>

        {/* Encrypted with your passphrase */}
        <Section icon={<Lock size={14} />} title={about.cryptoTitle}>
          <p>{about.cryptoBody}</p>
        </Section>

        {/* Sharing */}
        <Section icon={<Share2 size={14} />} title={about.shareTitle}>
          <p>{about.shareBody}</p>
        </Section>

        {/* Export & import */}
        <Section icon={<Download size={14} />} title={about.exportTitle}>
          <p>{about.exportBody}</p>
        </Section>

        {/* Languages */}
        <Section icon={<Languages size={14} />} title={about.langTitle}>
          <p>{about.langBody}</p>
        </Section>

        {/* Open source link */}
        <Section icon={<Github size={14} />} title={about.openSource}>
          <p className="mb-2">{about.openSourceDesc}</p>
          <a
            href="https://github.com/AbdAsh/FamilyTreeVisualizer"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-amber hover:text-amber-dark transition-colors"
          >
            <Github size={12} />
            AbdAsh/FamilyTreeVisualizer
            <ExternalLink size={10} />
          </a>
        </Section>

        {/* Size footnote */}
        <p className="text-[10px] text-cream-dark leading-relaxed border-t border-charcoal-lighter pt-4">
          {about.sizeNote}
        </p>

        {/* Divider */}
        <div className="border-t border-charcoal-lighter" />

        {/* Developer */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-md border border-charcoal-lighter flex items-center justify-center text-amber font-display font-bold text-sm">
            AM
          </div>
          <div className="min-w-0">
            <p className="font-display text-base font-medium text-cream tracking-tight">
              {about.developer}
            </p>
            <p className="text-[11px] text-cream-dark mb-2">
              {about.developerRole}
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="https://abdash.net"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-charcoal border border-charcoal-lighter text-[10px] text-cream-dark hover:text-amber hover:border-amber/40 transition-colors"
              >
                <Globe size={10} />
                {about.viewWebsite}
              </a>
              <a
                href="https://github.com/AbdAsh"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-charcoal border border-charcoal-lighter text-[10px] text-cream-dark hover:text-amber hover:border-amber/40 transition-colors"
              >
                <Github size={10} />
                {about.viewGithub}
              </a>
              <a
                href="https://linkedin.com/in/abdash"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-charcoal border border-charcoal-lighter text-[10px] text-cream-dark hover:text-amber hover:border-amber/40 transition-colors"
              >
                <Linkedin size={10} />
                {about.viewLinkedin}
              </a>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
