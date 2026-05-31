import LogoPromoPage from './LogoPromoPage.jsx';

// Página pública de Política de Privacidade — LGPD-compliant.
// Renderiza em tela cheia (mesmo pattern da ModalPlanos) com Voltar no topo
// e rodapé institucional no final. Diferente do concorrente: bases legais
// LGPD EXPLÍCITAS por finalidade, lista nominal de subprocessadores, política
// específica de menores, e linguagem clara (não juridiquês).

const ULTIMA_ATUALIZACAO = '31 de maio de 2026';
const VIGENTE_DESDE = '1º de janeiro de 2026';

// Lista nominal de subprocessadores — diferencial vs concorrente que só fala
// "Google e Meta" genérico. Aqui o usuário vê EXATAMENTE quem recebe dados e
// pra quê. Atualizar sempre que adicionar/remover integração de terceiros.
const SUBPROCESSADORES = [
  {
    nome: 'Mercado Pago',
    finalidade: 'Processamento de pagamentos (cartão, PIX, boleto) e emissão de NFs',
    dados: 'Nome, e-mail, CPF, dados do cartão (tokenizado), valor da transação',
    pais: 'Brasil',
  },
  {
    nome: 'Resend',
    finalidade: 'Envio de e-mails transacionais (boas-vindas, recuperação de senha, notificações)',
    dados: 'Nome, e-mail',
    pais: 'EUA (com cláusulas de transferência internacional adequadas)',
  },
  {
    nome: 'HostGator',
    finalidade: 'Hospedagem dos servidores da aplicação e banco de dados',
    dados: 'Todos os dados da plataforma (criptografados em repouso)',
    pais: 'Brasil',
  },
  {
    nome: 'Cloudflare',
    finalidade: 'CDN, proteção contra ataques DDoS e cache de assets estáticos',
    dados: 'Endereço IP, headers HTTP (sem conteúdo de formulários)',
    pais: 'Global',
  },
];

export default function ModalPoliticaPrivacidade({ aberto, aoFechar }) {
  if (!aberto) return null;

  return (
    <div className="mp-pagina">
      {/* Barra de topo: voltar + logo */}
      <div className="mp-pagina-topo">
        <button className="mp-voltar" onClick={aoFechar}>← Voltar</button>
        <LogoPromoPage size={34} aoClick={aoFechar} />
        <span className="mp-topo-spacer" aria-hidden="true" />
      </div>

      <div className="mp-pagina-conteudo">
        {/* HEADER */}
        <div className="pp-header">
          <h1 className="pp-titulo-principal">Política de Privacidade</h1>
          <div className="pp-meta">
            <span>📅 Última atualização: <b>{ULTIMA_ATUALIZACAO}</b></span>
            <span>·</span>
            <span>Vigente desde: <b>{VIGENTE_DESDE}</b></span>
          </div>
          <p className="pp-intro">
            Nós, da <b>PromoPage</b>, levamos sua privacidade a sério. Esta política
            explica em linguagem clara — sem juridiquês — quais dados coletamos,
            por que coletamos, com quem compartilhamos e quais são seus direitos
            segundo a <b>Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018)</b>.
          </p>
          <div className="pp-resumo-box">
            <div className="pp-resumo-titulo">📋 Resumo executivo (TL;DR)</div>
            <ul className="pp-resumo-lista">
              <li>Coletamos apenas o <b>essencial</b> pra plataforma funcionar (cadastro + uso).</li>
              <li><b>Nunca vendemos</b> seus dados pra ninguém. Ponto final.</li>
              <li>Compartilhamos apenas com 4 subprocessadores listados abaixo (pagamento, e-mail, hospedagem, CDN).</li>
              <li>Você tem direito a <b>acessar, corrigir, exportar e excluir</b> seus dados a qualquer momento.</li>
              <li>Cookies essenciais sempre; analíticos só com seu consentimento.</li>
              <li>Não direcionamos a plataforma a menores de 18 anos.</li>
            </ul>
          </div>
        </div>

        {/* SEÇÕES NUMERADAS */}
        <div className="pp-secoes">

          <section className="pp-secao">
            <h2><span className="pp-num">1.</span> Quem somos</h2>
            <p>
              A <b>PromoPage</b> é uma plataforma SaaS de criação de encartes e materiais
              promocionais pra comércio varejista. CNPJ <b>59.885.670/0001-85</b>,
              com sede em Londrina/PR. Para efeitos da LGPD, atuamos como
              <b> Controlador</b> dos dados que você nos fornece diretamente
              (cadastro, conteúdo criado) e como <b>Operador</b> dos dados pessoais
              que você cadastra em sua conta (ex: catálogo de produtos da sua loja).
            </p>
          </section>

          <section className="pp-secao">
            <h2><span className="pp-num">2.</span> Quais dados coletamos</h2>
            <p>Coletamos apenas o necessário pra plataforma funcionar. Dividimos em 3 grupos:</p>

            <div className="pp-categoria">
              <h3>📝 Dados que você nos fornece</h3>
              <ul>
                <li><b>Cadastro:</b> nome, e-mail, senha (armazenada com hash bcrypt — nem nossos engenheiros conseguem ler).</li>
                <li><b>Perfil:</b> foto opcional, nome da loja, telefone (opcional, só pra suporte).</li>
                <li><b>Pagamento:</b> dados do cartão são <b>tokenizados pelo Mercado Pago</b> — não temos acesso ao número completo. Pra PIX e boleto, só armazenamos o status da transação.</li>
                <li><b>Conteúdo criado:</b> encartes, temas customizados, catálogo de produtos da sua loja, imagens enviadas.</li>
              </ul>
            </div>

            <div className="pp-categoria">
              <h3>🔧 Dados de uso e técnicos</h3>
              <ul>
                <li><b>Logs de acesso:</b> data, hora, endereço IP (anonimizado após 30 dias), navegador, sistema operacional.</li>
                <li><b>Histórico de uso:</b> encartes criados, temas favoritados, exportações realizadas — pra estatísticas internas e melhorar o produto.</li>
                <li><b>Cookies essenciais:</b> token de sessão (mantém você logado).</li>
              </ul>
            </div>

            <div className="pp-categoria">
              <h3>❌ Dados que NÃO coletamos</h3>
              <ul>
                <li>Não coletamos CPF de pessoas físicas (só CNPJ no cadastro empresarial, opcional).</li>
                <li>Não coletamos localização geográfica precisa via GPS.</li>
                <li>Não rastreamos sua navegação fora da nossa plataforma.</li>
                <li>Não acessamos contatos, agenda ou arquivos do seu dispositivo.</li>
              </ul>
            </div>
          </section>

          <section className="pp-secao">
            <h2><span className="pp-num">3.</span> Por que coletamos — base legal LGPD</h2>
            <p>
              A LGPD exige que toda coleta tenha uma <b>base legal</b>. Pra cada
              finalidade, listamos qual base aplica (Art. 7º LGPD):
            </p>
            <table className="pp-tabela">
              <thead>
                <tr>
                  <th>Finalidade</th>
                  <th>Base legal</th>
                  <th>Pode opt-out?</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Criar e manter sua conta na plataforma</td>
                  <td>Execução de contrato (Art. 7º V)</td>
                  <td>Não (sem isso a conta não funciona)</td>
                </tr>
                <tr>
                  <td>Processar pagamentos da assinatura</td>
                  <td>Execução de contrato (Art. 7º V)</td>
                  <td>Não enquanto for assinante</td>
                </tr>
                <tr>
                  <td>Enviar e-mails transacionais (recibo, recuperação senha)</td>
                  <td>Execução de contrato (Art. 7º V)</td>
                  <td>Não (necessários pra operação)</td>
                </tr>
                <tr>
                  <td>Enviar e-mails de novidades, dicas e promoções</td>
                  <td>Consentimento (Art. 7º I)</td>
                  <td><b>Sim, a qualquer momento</b></td>
                </tr>
                <tr>
                  <td>Análise interna pra melhorar o produto</td>
                  <td>Legítimo interesse (Art. 7º IX)</td>
                  <td>Sim, via solicitação</td>
                </tr>
                <tr>
                  <td>Detectar fraude e proteger a plataforma</td>
                  <td>Legítimo interesse (Art. 7º IX)</td>
                  <td>Não (proteção mútua)</td>
                </tr>
                <tr>
                  <td>Cumprir obrigações fiscais e legais</td>
                  <td>Obrigação legal (Art. 7º II)</td>
                  <td>Não (exigência legal)</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="pp-secao">
            <h2><span className="pp-num">4.</span> Com quem compartilhamos</h2>
            <p>
              <b>Nunca vendemos seus dados pra anunciantes, data brokers ou qualquer terceiro.</b>
              Só compartilhamos com os 4 subprocessadores abaixo, todos contratualmente
              obrigados a cumprir a LGPD:
            </p>
            <div className="pp-subprocessadores">
              {SUBPROCESSADORES.map(s => (
                <div key={s.nome} className="pp-sub-card">
                  <div className="pp-sub-nome">{s.nome}</div>
                  <div className="pp-sub-linha"><b>Finalidade:</b> {s.finalidade}</div>
                  <div className="pp-sub-linha"><b>Dados:</b> {s.dados}</div>
                  <div className="pp-sub-linha"><b>País:</b> {s.pais}</div>
                </div>
              ))}
            </div>
            <p className="pp-nota">
              <b>Excepcionalmente,</b> podemos compartilhar dados com autoridades públicas
              (Receita Federal, Polícia, Ministério Público) <b>apenas mediante ordem
              judicial</b> ou requisição legal específica.
            </p>
          </section>

          <section className="pp-secao">
            <h2><span className="pp-num">5.</span> Seus direitos (Art. 18 LGPD)</h2>
            <p>Você pode, a qualquer momento e sem pagar nada:</p>
            <div className="pp-direitos-grid">
              <div className="pp-direito-card">
                <div className="pp-direito-icone">✓</div>
                <div className="pp-direito-titulo">Confirmar existência de tratamento</div>
                <div className="pp-direito-desc">Saber se temos dados seus (sim, se você tem conta — confirmado pelo email cadastrado).</div>
              </div>
              <div className="pp-direito-card">
                <div className="pp-direito-icone">👁️</div>
                <div className="pp-direito-titulo">Acessar seus dados</div>
                <div className="pp-direito-desc">Vê tudo que temos sobre você na sua área "Meu Perfil" — sem precisar pedir.</div>
              </div>
              <div className="pp-direito-card">
                <div className="pp-direito-icone">✏️</div>
                <div className="pp-direito-titulo">Corrigir dados</div>
                <div className="pp-direito-desc">Edita nome, e-mail, foto e dados de pagamento direto no painel.</div>
              </div>
              <div className="pp-direito-card">
                <div className="pp-direito-icone">📦</div>
                <div className="pp-direito-titulo">Portabilidade</div>
                <div className="pp-direito-desc">Exporta TODOS seus encartes em PDF/PNG + um JSON com seu catálogo de produtos.</div>
              </div>
              <div className="pp-direito-card">
                <div className="pp-direito-icone">🗑️</div>
                <div className="pp-direito-titulo">Excluir conta e dados</div>
                <div className="pp-direito-desc">Botão "Excluir minha conta" no perfil — apaga TUDO em até 30 dias.</div>
              </div>
              <div className="pp-direito-card">
                <div className="pp-direito-icone">🚫</div>
                <div className="pp-direito-titulo">Revogar consentimento</div>
                <div className="pp-direito-desc">Cancela e-mails marketing num clique (link no rodapé de qualquer e-mail).</div>
              </div>
              <div className="pp-direito-card">
                <div className="pp-direito-icone">📨</div>
                <div className="pp-direito-titulo">Saber com quem compartilhamos</div>
                <div className="pp-direito-desc">Lista completa de subprocessadores está na seção 4 desta política.</div>
              </div>
              <div className="pp-direito-card">
                <div className="pp-direito-icone">⚖️</div>
                <div className="pp-direito-titulo">Reclamar à ANPD</div>
                <div className="pp-direito-desc">Se não atendermos sua solicitação, pode reclamar na <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer">Autoridade Nacional de Proteção de Dados</a>.</div>
              </div>
            </div>
            <p className="pp-nota">
              <b>Como exercer:</b> escreva pra <a href="mailto:privacidade@promopage.com.br">privacidade@promopage.com.br</a> ou
              chame nosso DPO via WhatsApp. Respondemos em <b>até 15 dias úteis</b>
              (prazo legal LGPD).
            </p>
          </section>

          <section className="pp-secao">
            <h2><span className="pp-num">6.</span> Por quanto tempo guardamos</h2>
            <ul className="pp-lista-tempos">
              <li><b>Conta ativa:</b> enquanto sua conta existir.</li>
              <li><b>Conta cancelada:</b> projetos em modo "somente leitura" por <b>90 dias</b> (caso queira voltar). Após isso, exclusão permanente.</li>
              <li><b>Logs de acesso (IP, navegador):</b> 6 meses (depois, anonimização).</li>
              <li><b>Dados fiscais (notas, pagamentos):</b> 5 anos (exigência da Receita Federal).</li>
              <li><b>Backups criptografados:</b> 30 dias (rotação automática).</li>
            </ul>
          </section>

          <section className="pp-secao">
            <h2><span className="pp-num">7.</span> Segurança</h2>
            <p>O que fazemos pra proteger seus dados:</p>
            <ul>
              <li>🔐 <b>Senhas com hash bcrypt</b> (12 rounds) — irrecuperáveis mesmo internamente.</li>
              <li>🔒 <b>HTTPS/TLS 1.3</b> em toda a plataforma — tráfego sempre criptografado.</li>
              <li>🛡️ <b>Proteção contra ataques</b> via Cloudflare (DDoS, SQL injection, XSS).</li>
              <li>💾 <b>Banco de dados criptografado em repouso</b> (AES-256).</li>
              <li>👥 <b>Acesso interno limitado</b> — só engenheiros sêniores, com auditoria de todos os acessos.</li>
              <li>🧪 <b>Pen-tests anuais</b> com empresa especializada (próximo: out/2026).</li>
            </ul>
            <div className="pp-incidente-box">
              <b>🚨 Em caso de incidente de segurança</b> que possa afetar você,
              vamos te notificar por e-mail em até <b>72 horas</b> após confirmação
              do incidente, e à ANPD conforme exige a LGPD.
            </div>
          </section>

          <section className="pp-secao">
            <h2><span className="pp-num">8.</span> Cookies</h2>
            <p>Usamos cookies de 3 tipos:</p>
            <div className="pp-cookies-grid">
              <div className="pp-cookie-card cookie-essencial">
                <div className="pp-cookie-tipo">✅ Essenciais</div>
                <div className="pp-cookie-desc">
                  Token de sessão (mantém você logado), preferências de UI (painel
                  recolhido/expandido). <b>Não dá pra desativar</b> — sem isso a
                  plataforma não funciona.
                </div>
              </div>
              <div className="pp-cookie-card cookie-analitico">
                <div className="pp-cookie-tipo">📊 Analíticos</div>
                <div className="pp-cookie-desc">
                  Estatísticas de uso pra melhorar o produto (quais grades são mais
                  populares, onde o usuário trava). <b>Opcional — você consente
                  ao aceitar o banner de cookies</b>.
                </div>
              </div>
              <div className="pp-cookie-card cookie-marketing">
                <div className="pp-cookie-tipo">📣 Marketing</div>
                <div className="pp-cookie-desc">
                  Pra remarketing em redes sociais e Google. <b>Opt-in explícito</b> —
                  só ativamos se você marcar a checkbox correspondente.
                </div>
              </div>
            </div>
            <p className="pp-nota">
              Você pode revogar consentimento dos cookies opcionais a qualquer
              momento limpando o cookie do navegador ou usando o painel de
              preferências de cookies (canto inferior direito do site).
            </p>
          </section>

          <section className="pp-secao">
            <h2><span className="pp-num">9.</span> Dados de menores</h2>
            <p>
              A PromoPage <b>não é direcionada a menores de 18 anos</b>. Não coletamos
              conscientemente dados de menores. Se você é responsável legal e descobriu
              que um menor sob sua tutela criou conta sem permissão, escreva pra
              <a href="mailto:privacidade@promopage.com.br"> privacidade@promopage.com.br</a> que
              <b> excluímos a conta e todos os dados associados em até 7 dias úteis</b>.
            </p>
          </section>

          <section className="pp-secao">
            <h2><span className="pp-num">10.</span> Transferência internacional</h2>
            <p>
              Alguns subprocessadores (como o Resend e a Cloudflare) operam servidores
              fora do Brasil. Isso é permitido pela LGPD desde que o país tenha
              proteção adequada OU haja cláusulas contratuais específicas (SCCs).
              Mantemos contratos com cláusulas LGPD-equivalentes com todos os
              parceiros internacionais. Lista completa na seção 4.
            </p>
          </section>

          <section className="pp-secao">
            <h2><span className="pp-num">11.</span> Mudanças nesta política</h2>
            <p>
              Podemos atualizar esta política pra refletir mudanças no produto, na
              legislação ou em nossos parceiros. Quando fizermos uma <b>mudança
              significativa</b> (ex: novo subprocessador, nova finalidade de uso),
              vamos te avisar por e-mail e via banner no app com pelo menos
              <b> 30 dias de antecedência</b>. Mudanças menores (correção de erros,
              clarificação de texto) entram em vigor imediatamente, com a data de
              "última atualização" no topo desta página atualizada.
            </p>
          </section>

          <section className="pp-secao">
            <h2><span className="pp-num">12.</span> Contato e DPO</h2>
            <p>
              Nosso <b>Encarregado de Dados (DPO)</b> está disponível pra qualquer
              dúvida, solicitação de direitos ou reclamação relacionada a privacidade:
            </p>
            <div className="pp-contato-box">
              <div className="pp-contato-linha">
                <span className="pp-contato-label">📧 E-mail:</span>
                <a href="mailto:privacidade@promopage.com.br">privacidade@promopage.com.br</a>
              </div>
              <div className="pp-contato-linha">
                <span className="pp-contato-label">💬 WhatsApp:</span>
                <span>Suporte com gente real (resposta em até 1h em horário comercial)</span>
              </div>
              <div className="pp-contato-linha">
                <span className="pp-contato-label">🏢 Endereço:</span>
                <span>Rua Amália Tonon Minatti, 78 — Cafezal, Londrina/PR, CEP 86.045-210</span>
              </div>
              <div className="pp-contato-linha">
                <span className="pp-contato-label">🏛️ CNPJ:</span>
                <span>59.885.670/0001-85</span>
              </div>
            </div>
            <p className="pp-nota" style={{ marginTop: 20 }}>
              Se ainda assim você não estiver satisfeito com nossa resposta, você
              pode levar o caso à <b>Autoridade Nacional de Proteção de Dados (ANPD)</b>:
              <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer"> gov.br/anpd</a>.
            </p>
          </section>

        </div>

        {/* Footer interno: assinatura + botão voltar */}
        <div className="pp-rodape">
          <p className="pp-assinatura">
            <b>Equipe PromoPage</b> · Comprometidos com sua privacidade desde 2026 💚
          </p>
          <button className="pp-btn-voltar" onClick={aoFechar}>← Voltar pra plataforma</button>
        </div>
      </div>
    </div>
  );
}
