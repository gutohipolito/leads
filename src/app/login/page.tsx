'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from './login.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      console.log('Iniciando tentativa de login para:', email);
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      console.log('Resposta do Supabase recebida:', { data, error: authError });

      if (authError) throw authError;

      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <video 
        autoPlay 
        muted 
        loop 
        playsInline 
        className={styles.videoBackground}
      >
        <source src="/3141208-uhd_3840_2160_25fps.mp4" type="video/mp4" />
      </video>
      <div className={styles.videoOverlay} />
      <div className={styles.backgroundGlow} />
      
      <div className={`${styles.loginCard} glass`}>
        <div className={styles.header}>
          <img src="/asthros-leads.png" alt="Asthros Leads" className={styles.logoImg} />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form className={styles.form} onSubmit={handleLogin}>
          <div className={styles.inputGroup}>
            <label htmlFor="email">E-mail</label>
            <input 
              id="email"
              type="email" 
              placeholder="seu@email.com" 
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password">Senha</label>
            <input 
              id="password"
              type="password" 
              placeholder="••••••••" 
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? 'AUTENTICANDO...' : 'ENTRAR NO SISTEMA'}
          </button>
        </form>

        <div className={styles.footer}>
          <span>Não tem acesso? <br /></span>
          <a href="#">Fale com o Administrador</a>
        </div>
      </div>

      <p className={styles.copyright}>
        © {new Date().getFullYear()} - Todos os direitos reservados.
      </p>
    </div>
  );
}
