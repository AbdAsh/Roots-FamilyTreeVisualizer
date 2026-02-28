/**
 * About modal — explains Roots' functionality, algorithms, encryption,
 * compression methods, and credits the developer.
 *
 * Triggered by the "About" button in the header. Uses the base {@link Modal} component.
 *
 * @module AboutModal
 */
import { Modal } from '@/components/ui/Modal';
import { useI18n } from '@/lib/i18n';
import {
  TreePine,
  Shield,
  Cpu,
  Lock,
  Archive,
  EyeOff,
  Code2,
  Github,
  Linkedin,
  Globe,
  ExternalLink,
  ArrowRight,
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
        <div className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-amber/10 border border-amber/20 flex items-center justify-center text-amber">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-cream mb-1">{title}</h3>
          <div className="text-xs text-cream/50 leading-relaxed">
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
        <Section icon={<TreePine size={14} />} title={about.whatIsRoots}>
          <p>{about.whatIsRootsDesc}</p>
        </Section>

        {/* How It Works */}
        <Section icon={<Cpu size={14} />} title={about.howItWorks}>
          <p className="mb-2">{about.howItWorksDesc}</p>
          <div className="px-3 py-2 rounded-lg bg-charcoal/60 border border-charcoal-lighter/40 font-mono text-[10px] text-amber/80 flex items-center gap-1 flex-wrap">
            <span>JSON</span>
            <ArrowRight size={10} className="text-cream/30" />
            <span>Brotli</span>
            <ArrowRight size={10} className="text-cream/30" />
            <span>AES-GCM</span>
            <ArrowRight size={10} className="text-cream/30" />
            <span>Base64url</span>
            <ArrowRight size={10} className="text-cream/30" />
            <span>URL#</span>
          </div>
        </Section>

        {/* Layout Algorithm */}
        <Section icon={<Code2 size={14} />} title={about.layoutAlgorithm}>
          <p>{about.layoutAlgorithmDesc}</p>
        </Section>

        {/* Encryption */}
        <Section icon={<Lock size={14} />} title={about.encryption}>
          <p className="mb-2">{about.encryptionDesc}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-cream/40">
            <span>Algorithm</span>
            <span className="text-cream/60">AES-256-GCM</span>
            <span>Key derivation</span>
            <span className="text-cream/60">PBKDF2 · 600k iterations</span>
            <span>Salt</span>
            <span className="text-cream/60">16 bytes (random)</span>
            <span>IV</span>
            <span className="text-cream/60">12 bytes (random)</span>
          </div>
        </Section>

        {/* Compression */}
        <Section icon={<Archive size={14} />} title={about.compression}>
          <p>{about.compressionDesc}</p>
        </Section>

        {/* Privacy */}
        <Section icon={<EyeOff size={14} />} title={about.privacy}>
          <p>{about.privacyDesc}</p>
        </Section>

        {/* Tech Stack */}
        <Section icon={<Shield size={14} />} title={about.techStack}>
          <div className="flex flex-wrap gap-1.5">
            {[
              'React 19',
              'TypeScript',
              'Zustand',
              'D3',
              'Framer Motion',
              'Tailwind v4',
              'Vite 7',
              'Zod',
              'Web Crypto',
              'Brotli WASM',
            ].map((tech) => (
              <span
                key={tech}
                className="px-2 py-0.5 rounded-md bg-charcoal/60 border border-charcoal-lighter/40 text-[10px] text-cream/50"
              >
                {tech}
              </span>
            ))}
          </div>
        </Section>

        {/* Open Source */}
        <Section icon={<Github size={14} />} title={about.openSource}>
          <p className="mb-2">{about.openSourceDesc}</p>
          <a
            href="https://github.com/AbdAsh/FamilyTreeVisualizer"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-amber hover:text-amber-light transition-colors"
          >
            <Github size={12} />
            AbdAsh/FamilyTreeVisualizer
            <ExternalLink size={10} />
          </a>
        </Section>

        {/* Divider */}
        <div className="border-t border-charcoal-lighter/40" />

        {/* Developer */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-amber/10 border border-amber/20 flex items-center justify-center text-amber font-display font-bold text-sm">
            AM
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-cream">
              {about.developer}
            </p>
            <p className="text-[11px] text-cream/40 mb-2">
              {about.developerRole}
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="https://abdash.net"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-charcoal/60 border border-charcoal-lighter/40 text-[10px] text-cream/50 hover:text-amber hover:border-amber/30 transition-colors"
              >
                <Globe size={10} />
                {about.viewWebsite}
              </a>
              <a
                href="https://github.com/AbdAsh"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-charcoal/60 border border-charcoal-lighter/40 text-[10px] text-cream/50 hover:text-amber hover:border-amber/30 transition-colors"
              >
                <Github size={10} />
                {about.viewGithub}
              </a>
              <a
                href="https://linkedin.com/in/abdash"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-charcoal/60 border border-charcoal-lighter/40 text-[10px] text-cream/50 hover:text-amber hover:border-amber/30 transition-colors"
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
