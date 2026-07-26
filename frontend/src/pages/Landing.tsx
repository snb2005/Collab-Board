import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Pencil, Users, History, Shield, MessageSquare, MousePointer2,
  ArrowRight, Zap, Layers, ChevronRight, Lock, Eye, LayoutDashboard
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'

const features = [
  {
    icon: <Users size={28} />,
    title: 'Real-time Collaboration',
    desc: 'Work together on the same canvas simultaneously. See changes as they happen with zero delay.',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  },
  {
    icon: <History size={28} />,
    title: 'Version History',
    desc: 'Save snapshots, browse previous versions, and restore any state instantly — never lose your work.',
    gradient: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
  },
  {
    icon: <Shield size={28} />,
    title: 'Secure Workspaces',
    desc: 'Create public or password-protected private workspaces with full control over access and visibility.',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
  },
  {
    icon: <MousePointer2 size={28} />,
    title: 'Live Cursors',
    desc: 'See exactly where your teammates are pointing. Color-coded cursors with name labels for each user.',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
  },
  {
    icon: <MessageSquare size={28} />,
    title: 'Comments & Feedback',
    desc: 'Drop contextual comments directly on the board. Resolve threads when feedback is addressed.',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
  },
  {
    icon: <Lock size={28} />,
    title: 'Role-Based Access',
    desc: 'Owners, Editors, and Viewers — fine-grained permissions so everyone has exactly the right access.',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
  },
]

const steps = [
  { num: '01', title: 'Create a Workspace', desc: 'Set up a shared space for your team — public or private, your choice.' },
  { num: '02', title: 'Invite Your Team', desc: 'Share invite links with custom expiration. Teammates join with one click.' },
  { num: '03', title: 'Collaborate in Real-time', desc: 'Draw, brainstorm, and iterate together on an infinite canvas.' },
]

function useInView() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold: 0.15 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

export function Landing() {
  const { user } = useAuth()
  const isLoggedIn = !!user
  const featuresView = useInView()
  const stepsView = useInView()
  const ctaView = useInView()

  return (
    <main className="landing">
      {/* Navbar */}
      <nav className="landing-nav">
        <div className="nav-inner">
          <Link to="/" className="nav-brand">
            <div className="nav-logo">
              <Layers size={20} />
            </div>
            <span>Collab Board</span>
          </Link>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it Works</a>
          </div>
          <div className="nav-actions">
            {isLoggedIn ? (
              <Link to="/dashboard" className="nav-cta">
                <LayoutDashboard size={14} /> Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="nav-signin">Sign in</Link>
                <Link to="/register" className="nav-cta">
                  Create Account <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-glow" />
        <div className="hero-glow-2" />
        <div className="hero-content">
          <div className="hero-badge">
            <Zap size={14} />
            <span>Real-time collaborative whiteboard</span>
          </div>
          <h1>
            Where ideas come<br />
            <span className="gradient-text">alive together.</span>
          </h1>
          <p className="hero-subtitle">
            A powerful, real-time collaborative whiteboard for teams. Draw, brainstorm,
            and create on an infinite canvas — with live cursors, version history, and
            role-based access built in.
          </p>
          <div className="hero-buttons">
            {isLoggedIn ? (
              <Link to="/dashboard" className="hero-primary">
                <LayoutDashboard size={16} /> Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/register" className="hero-primary">
                  Create Free Account <ArrowRight size={16} />
                </Link>
                <Link to="/login" className="hero-secondary">
                  Sign In <ChevronRight size={16} />
                </Link>
              </>
            )}
          </div>
          <div className="hero-stats">
            <div className="stat">
              <Eye size={16} />
              <span>Live Cursors</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <History size={16} />
              <span>Version History</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <Shield size={16} />
              <span>Secure Access</span>
            </div>
          </div>
        </div>

        {/* Floating canvas preview */}
        <div className="hero-visual">
          <div className="hero-canvas-preview">
            <div className="canvas-chrome">
              <span className="chrome-dot red" />
              <span className="chrome-dot yellow" />
              <span className="chrome-dot green" />
            </div>
            <div className="canvas-body">
              <svg viewBox="0 0 400 240" fill="none">
                <rect x="40" y="30" width="100" height="70" rx="8" stroke="#6366f1" strokeWidth="2" fill="#6366f115" />
                <ellipse cx="260" cy="65" rx="50" ry="35" stroke="#10b981" strokeWidth="2" fill="#10b98115" />
                <line x1="140" y1="65" x2="210" y2="65" stroke="#f59e0b" strokeWidth="2" markerEnd="url(#arr)" />
                <text x="60" y="150" fill="#475569" fontSize="12" fontFamily="Inter">Brainstorm</text>
                <rect x="50" y="160" width="120" height="50" rx="6" stroke="#ec4899" strokeWidth="1.5" fill="#ec489915" />
                <text x="230" y="150" fill="#475569" fontSize="12" fontFamily="Inter">Ship it! 🚀</text>
                <rect x="220" y="160" width="130" height="50" rx="6" stroke="#3b82f6" strokeWidth="1.5" fill="#3b82f615" />
                <defs>
                  <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L7,3 z" fill="#f59e0b" />
                  </marker>
                </defs>
                {/* Cursor 1 */}
                <g transform="translate(180, 100)">
                  <path d="M0,0 L0,12 L3,9 L6,14 L8,13 L5,8 L9,8 Z" fill="#6366f1" stroke="#fff" strokeWidth="0.8" />
                  <rect x="10" y="6" rx="3" width="36" height="14" fill="#6366f1" opacity="0.9" />
                  <text x="14" y="16" fontSize="8" fill="#fff" fontWeight="600">Alice</text>
                </g>
                {/* Cursor 2 */}
                <g transform="translate(300, 180)">
                  <path d="M0,0 L0,12 L3,9 L6,14 L8,13 L5,8 L9,8 Z" fill="#10b981" stroke="#fff" strokeWidth="0.8" />
                  <rect x="10" y="6" rx="3" width="28" height="14" fill="#10b981" opacity="0.9" />
                  <text x="14" y="16" fontSize="8" fill="#fff" fontWeight="600">Bob</text>
                </g>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className={`landing-features ${featuresView.visible ? 'in-view' : ''}`}
        ref={featuresView.ref}
      >
        <div className="section-header">
          <span className="section-badge">Features</span>
          <h2>Everything your team needs</h2>
          <p>Built for teams that think visually. Every feature is designed for seamless real-time collaboration.</p>
        </div>
        <div className="features-grid-landing">
          {features.map((f, i) => (
            <div
              className="feature-card-landing"
              key={f.title}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="feature-icon" style={{ background: f.gradient }}>
                {f.icon}
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        className={`landing-steps ${stepsView.visible ? 'in-view' : ''}`}
        ref={stepsView.ref}
      >
        <div className="section-header">
          <span className="section-badge">How it Works</span>
          <h2>Get started in minutes</h2>
          <p>Three simple steps to unlock real-time collaboration for your team.</p>
        </div>
        <div className="steps-grid">
          {steps.map((s, i) => (
            <div className="step-card" key={s.num} style={{ animationDelay: `${i * 0.12}s` }}>
              <span className="step-num">{s.num}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section
        className={`landing-cta ${ctaView.visible ? 'in-view' : ''}`}
        ref={ctaView.ref}
      >
        <div className="cta-inner">
          <h2>Ready to collaborate?</h2>
          <p>Create your free account and start whiteboarding with your team in seconds.</p>
          <div className="cta-buttons">
            {isLoggedIn ? (
              <Link to="/dashboard" className="cta-primary">
                <LayoutDashboard size={16} /> Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/register" className="cta-primary">
                  Create Free Account <ArrowRight size={16} />
                </Link>
                <Link to="/login" className="cta-secondary">
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <Layers size={18} />
            <span>Collab Board</span>
          </div>
          <p>A real-time collaborative whiteboard for modern teams.</p>
        </div>
      </footer>
    </main>
  )
}
