// mapa_corrida.js
async function verificarCorridaAtivaPassageiro() {
  const dadosUsuario = JSON.parse(localStorage.getItem('passageiro_logado') || '{}');
  if (!dadosUsuario.id || !supabaseMapa) return;

  try {
    const { data } = await supabaseMapa
      .from('corridas')
      .select('*, motorista:motorista_id(nome, foto_url, nota)')
      .eq('passageiro_id', dadosUsuario.id)
      .in('status', ['procurando', 'aceito', 'a_caminho', 'no_local', 'em_andamento', 'concluido'])
      .order('id', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const corrida = data[0];
      corridaAtualId = corrida.id;

      if (corrida.status === 'procurando') {
        document.getElementById('painel-solicitacao').classList.add('hidden');
        document.getElementById('painel-espera-corrida').classList.remove('hidden');
        iniciarTimerEsperaCorrida();
      } else if (corrida.status === 'concluido') {
        exibirPainelAvaliacaoPassageiro(corrida);
      } else {
        exibirPainelMotoristaEncontrado(corrida);
      }
      iniciarEscutaPassageiroRealtime();
    }
  } catch (e) {}
}

async function iniciarRadarMotoristasOnline() {
  if (!supabaseMapa) return;
  const regras = obterRegrasMapa();
  atualizarPosicoesMotoristas();
  if (intervaloRadarMotoristas) clearInterval(intervaloRadarMotoristas);
  intervaloRadarMotoristas = setInterval(atualizarPosicoesMotoristas, regras.intervalo_radar_ms);
}

async function atualizarPosicoesMotoristas() {
  if (!mapaLeaflet) return;
  try {
    const { data: motoristas, error } = await supabaseMapa
      .from('usuarios')
      .select('id, lat, lng, online')
      .eq('online', true);

    if (error || !motoristas) return;

    const idsAtuais = motoristas.map(m => m.id);

    Object.keys(marcadoresMotoristas).forEach(id => {
      if (!idsAtuais.includes(id)) {
        mapaLeaflet.removeLayer(marcadoresMotoristas[id]);
        delete marcadoresMotoristas[id];
      }
    });

    const iconeCarroMapa = L.divIcon({
      className: 'custom-car-radar',
      html: '<div style="background-color: #10b981; color: #fff; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 8px rgba(0,0,0,0.6); border: 2px solid #fff;"><i class="fa-solid fa-car text-[10px]"></i></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    motoristas.forEach(m => {
      if (m.lat && m.lng) {
        if (marcadoresMotoristas[m.id]) {
          marcadoresMotoristas[m.id].setLatLng([m.lat, m.lng]);
        } else {
          const marcador = L.marker([m.lat, m.lng], { icon: iconeCarroMapa }).addTo(mapaLeaflet);
          marcadoresMotoristas[m.id] = marcador;
        }
      }
    });

    if (corridaAtualId) {
      const { data: corridaAtual } = await supabaseMapa
        .from('corridas')
        .select('motorista_id, status')
        .eq('id', corridaAtualId)
        .single();

      if (corridaAtual && corridaAtual.motorista_id && ['a_caminho', 'aceito'].includes(corridaAtual.status)) {
        const motEncontrado = motoristas.find(x => x.id === corridaAtual.motorista_id);
        if (motEncontrado && motEncontrado.lat && motEncontrado.lng && coordsOrigem) {
          const regras = obterRegrasMapa();
          const distancia = calcularDistanciaMetros(coordsOrigem.lat, coordsOrigem.lng, motEncontrado.lat, motEncontrado.lng);
          if (distancia <= regras.raio_alerta_proximidade_metros && !ultimaNotificacaoProximidade) {
            ultimaNotificacaoProximidade = true;
            mostrarModal('Motorista Próximo!', `O motorista está a menos de ${regras.raio_alerta_proximidade_metros} metros do seu local de embarque.`, 'sucesso', 4000);
          }
        }
      }
    }
  } catch (err) {}
}

async function chamarMotorista() {
  if (!calculoRotaPronto || valorCalculadoAtual <= 0) {
    mostrarModal('Aguarde o Cálculo', 'Selecione os endereços e aguarde o cálculo do valor antes de chamar.', 'cancelar', 3000);
    return;
  }

  const dadosUsuario = JSON.parse(localStorage.getItem('passageiro_logado') || '{}');
  if (!dadosUsuario.id) {
    mostrarModal('Erro de Autenticação', 'Passageiro não identificado. Faça login novamente.', 'cancelar', 2500);
    setTimeout(() => (window.location.href = 'auth.html'), 2500);
    return;
  }

  const clienteSupabaseAtivo = supabaseMapa || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
  if (!clienteSupabaseAtivo) {
    mostrarModal('Erro Crítico', 'Conexão com o banco de dados indisponível.', 'cancelar', 3500);
    return;
  }

  const btn = document.getElementById('btn-chamar-motorista');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> <span>Chamando motorista...</span>';

  try {
    const { data: usuarioAtualizado } = await clienteSupabaseAtivo
      .from('usuarios')
      .select('status')
      .eq('id', dadosUsuario.id)
      .single();

    if (usuarioAtualizado && (usuarioAtualizado.status === 'bloqueado' || usuarioAtualizado.status === 'pendente')) {
      mostrarModal('Conta Suspensa', 'Sua conta está suspensa ou pendente. Não é possível solicitar viagens.', 'cancelar', 4000);
      atualizarEstadoBotaoChamar('pronto');
      return;
    }
  } catch (e) {}

  const origem = document.getElementById('origem-corrida').value.trim();
  const destino = document.getElementById('destino-corrida').value.trim();
  const paradasValidas = obterListaParadasValidas();
  const paradaTexto = paradasValidas.length > 0 ? paradasValidas.map(p => p.texto).join(' | ') : null;

  if (!origem || !destino) {
    mostrarModal('Campos Incompletos', 'Por favor, preencha a origem e o destino.', 'cancelar', 3500);
    atualizarEstadoBotaoChamar('bloqueado');
    return;
  }

  const payloadCorrida = {
    passageiro_id: dadosUsuario.id,
    origem,
    destino,
    valor: Number(valorCalculadoAtual.toFixed(2)),
    forma_pagamento: String(formaPagamentoSelecionada || 'PIX'),
    status: 'procurando'
  };

  if (paradaTexto) {
    payloadCorrida.parada = paradaTexto;
  }

  const { data, error } = await clienteSupabaseAtivo.from('corridas').insert([payloadCorrida]).select().single();

  if (error) {
    mostrarModal('Erro', 'Erro ao solicitar corrida: ' + error.message, 'cancelar', 4000);
    atualizarEstadoBotaoChamar('pronto');
  } else {
    corridaAtualId = data.id;
    document.getElementById('painel-solicitacao').classList.add('hidden');
    document.getElementById('painel-espera-corrida').classList.remove('hidden');

    mostrarModal('Buscando Motorista', 'Sua solicitação foi enviada aos motoristas próximos.', 'sucesso', 3500);
    iniciarTimerEsperaCorrida();
    iniciarEscutaPassageiroRealtime();
  }
}

function iniciarEscutaPassageiroRealtime() {
  if (!corridaAtualId || !supabaseMapa) return;
  if (canalPassageiroRealtime) supabaseMapa.removeChannel(canalPassageiroRealtime);

  canalPassageiroRealtime = supabaseMapa
    .channel(`public:corridas_passageiro:${corridaAtualId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'corridas', filter: `id=eq.${corridaAtualId}` }, async payload => {
      if (payload.new) {
        const corridaAtualizada = payload.new;

        if (['aceito', 'a_caminho', 'no_local', 'em_andamento'].includes(corridaAtualizada.status)) {
          let motoristaInfo = { nome: 'Motorista', foto_url: '', nota: '5.0' };
          if (corridaAtualizada.motorista_id) {
            const { data: mot } = await supabaseMapa.from('usuarios').select('nome, foto_url, nota').eq('id', corridaAtualizada.motorista_id).single();
            if (mot) motoristaInfo = mot;
          }
          corridaAtualizada.motorista = motoristaInfo;
          exibirPainelMotoristaEncontrado(corridaAtualizada);
        } else if (corridaAtualizada.status === 'concluido') {
          exibirPainelAvaliacaoPassageiro(corridaAtualizada);
        } else if (corridaAtualizada.status === 'cancelado' || corridaAtualizada.status === 'expirado') {
          tocarSom('cancelar');
          mostrarModal('Aviso', 'A corrida foi encerrada ou cancelada.', 'cancelar', 3500);
          resetarPainelCompletoPassageiro();
        }
      }
    })
    .subscribe();
}

async function exibirPainelMotoristaEncontrado(corrida) {
  if (timerIntervalId) clearInterval(timerIntervalId);
  document.getElementById('painel-espera-corrida').classList.add('hidden');
  document.getElementById('painel-solicitacao').classList.add('hidden');
  document.getElementById('painel-avaliacao-passageiro').classList.add('hidden');

  const painelMotorista = document.getElementById('painel-motorista-encontrado');
  painelMotorista.classList.remove('hidden');

  let motorista = corrida.motorista;
  if (!motorista && corrida.motorista_id) {
    const { data: mot } = await supabaseMapa.from('usuarios').select('nome, foto_url, nota').eq('id', corrida.motorista_id).single();
    if (mot) motorista = mot;
  }

  const nomeMotorista = primeiroNome(motorista?.nome || 'Motorista Parceiro');
  const fotoMotorista = motorista?.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeMotorista)}`;
  const notaMotorista = motorista?.nota || '5.0';

  document.getElementById('passageiro-motorista-nome').innerText = nomeMotorista;
  document.getElementById('passageiro-motorista-foto').src = fotoMotorista;
  document.getElementById('passageiro-motorista-nota').innerText = notaMotorista;
  document.getElementById('pass-ativa-destino').innerText = corrida.destino;

  const blocoParadaAtiva = document.getElementById('bloco-parada-ativa-container');
  if (corrida.parada) {
    document.getElementById('pass-ativa-parada').innerText = corrida.parada;
    blocoParadaAtiva.classList.remove('hidden');
  } else {
    blocoParadaAtiva.classList.add('hidden');
  }

  const textoStatus = document.getElementById('passageiro-status-viagem-texto');
  const btnCancelarAtivo = document.getElementById('btn-cancelar-passageiro-ativo');
  const containerIlustracao = document.getElementById('container-ilustracao-jornada');
  const blocoEmbarque = document.getElementById('bloco-embarque-container');

  if (corrida.status === 'em_andamento') {
    textoStatus.innerText = 'Viagem em andamento';
    btnCancelarAtivo.classList.add('hidden');
    blocoEmbarque.style.display = 'none';

    containerIlustracao.innerHTML = `
      <i class="fa-solid fa-house text-sky-400 text-base" title="Início do Trajeto"></i>
      <div class="flex-1 border-t-2 border-dashed border-emerald-500/50 relative flex items-center justify-center">
        <i class="fa-solid fa-car text-emerald-400 absolute bg-slate-950 px-1 text-xs"></i>
      </div>
      <i class="fa-solid fa-flag-checkered text-amber-400 text-base" title="Destino Final"></i>
    `;
  } else {
    textoStatus.innerText = 'Motorista a caminho do embarque';
    btnCancelarAtivo.classList.remove('hidden');
    blocoEmbarque.style.display = 'block';
    document.getElementById('pass-ativa-origem').innerText = corrida.origem;

    containerIlustracao.innerHTML = `
      <i class="fa-solid fa-car text-emerald-400 text-base" title="Motorista a Caminho"></i>
      <div class="flex-1 border-t-2 border-dashed border-emerald-500/50 relative flex items-center justify-center">
        <i class="fa-solid fa-arrow-right text-emerald-500/80 absolute bg-slate-950 px-1 text-[10px]"></i>
      </div>
      <i class="fa-solid fa-house text-sky-400 text-base" title="Local de Embarque"></i>
    `;
  }
}

async function cancelarCorridaPassageiroAtiva() {
  if (!corridaAtualId || !supabaseMapa) return;
  if (confirm('Deseja realmente cancelar a corrida?')) {
    await supabaseMapa.from('corridas').update({ status: 'cancelado' }).eq('id', corridaAtualId);
    mostrarModal('Cancelado', 'Sua corrida foi cancelada.', 'cancelar', 3000);
    resetarPainelCompletoPassageiro();
  }
}

function exibirPainelAvaliacaoPassageiro(corrida) {
  document.getElementById('painel-motorista-encontrado').classList.add('hidden');
  document.getElementById('painel-espera-corrida').classList.add('hidden');
  document.getElementById('painel-solicitacao').classList.add('hidden');

  document.getElementById('passageiro-valor-final').innerText = `R$ ${(corrida.valor || 15.0).toFixed(2).replace('.', ',')}`;
  passageiroSelecionarEstrela(5);
  document.getElementById('passageiro-input-motivo-negativo').value = '';

  document.getElementById('painel-avaliacao-passageiro').classList.remove('hidden');
}

function passageiroSelecionarEstrela(nota) {
  passageiroNotaSelecionada = nota;
  const estrelas = document.querySelectorAll('#passageiro-container-estrelas i');
  const textoNota = document.getElementById('passageiro-texto-feedback');
  const blocoJustificativa = document.getElementById('passageiro-bloco-justificativa');

  estrelas.forEach((star, index) => {
    if (index < nota) {
      star.classList.remove('text-slate-600');
      star.classList.add('text-amber-400');
    } else {
      star.classList.remove('text-amber-400');
      star.classList.add('text-slate-600');
    }
  });

  if (nota === 5) {
    textoNota.innerText = 'Excelente (5 estrelas)';
    blocoJustificativa.classList.add('hidden');
  } else if (nota === 4) {
    textoNota.innerText = 'Bom (4 estrelas)';
    blocoJustificativa.classList.remove('hidden');
  } else if (nota === 3) {
    textoNota.innerText = 'Regular (3 estrelas)';
    blocoJustificativa.classList.remove('hidden');
  } else {
    textoNota.innerText = 'Ruim / Muito Ruim';
    blocoJustificativa.classList.remove('hidden');
  }
}

async function passageiroConcluirAvaliacao() {
  if (!corridaAtualId || !supabaseMapa) return;

  const motivo = document.getElementById('passageiro-input-motivo-negativo').value.trim();
  if (passageiroNotaSelecionada < 5 && !motivo) {
    mostrarModal('Atenção', 'Por favor, informe o motivo da avaliação baixa.', 'cancelar', 3000);
    return;
  }

  try {
    await supabaseMapa.from('corridas').update({
      avaliacao_passageiro: passageiroNotaSelecionada,
      motivo_avaliacao_passageiro: motivo || null
    }).eq('id', corridaAtualId);

    if (passageiroNotaSelecionada < 5) {
      const dadosUsuario = JSON.parse(localStorage.getItem('passageiro_logado') || '{}');
      if (dadosUsuario.id) {
        await supabaseMapa.from('mensagens_suporte_app').insert([{
          usuario_id: String(dadosUsuario.id),
          mensagem: `[Relato de Nota Baixa - Corrida #${corridaAtualId}] Nota: ${passageiroNotaSelecionada} estrelas. Motivo: ${motivo}`,
          remetente: 'passageiro',
          lido: false
        }]);
      }
    }

    mostrarModal('Obrigado', 'Avaliação enviada com sucesso!', 'sucesso', 3000);
    resetarPainelCompletoPassageiro();
  } catch (e) {
    mostrarModal('Erro', 'Erro ao enviar avaliação.', 'cancelar', 3000);
  }
}

function resetarPainelCompletoPassageiro() {
  if (timerIntervalId) clearInterval(timerIntervalId);
  if (canalPassageiroRealtime && supabaseMapa) supabaseMapa.removeChannel(canalPassageiroRealtime);
  corridaAtualId = null;
  ultimaNotificacaoProximidade = false;
  coordsDestino = null;
  coordsParadas = {};
  valorCalculadoAtual = 0;

  document.getElementById('painel-espera-corrida').classList.add('hidden');
  document.getElementById('painel-motorista-encontrado').classList.add('hidden');
  document.getElementById('painel-avaliacao-passageiro').classList.add('hidden');
  document.getElementById('painel-solicitacao').classList.remove('hidden');

  document.getElementById('destino-corrida').value = '';
  document.getElementById('container-paradas').innerHTML = '';
  document.getElementById('bloco-estimativa').classList.add('hidden');

  if (marcadorDestino && mapaLeaflet) {
    mapaLeaflet.removeLayer(marcadorDestino);
    marcadorDestino = null;
  }
  Object.values(marcadoresParadas).forEach(m => {
    if (mapaLeaflet) mapaLeaflet.removeLayer(m);
  });
  marcadoresParadas = {};

  if (polylineRota && mapaLeaflet) {
    mapaLeaflet.removeLayer(polylineRota);
    polylineRota = null;
  }

  atualizarEstadoBotaoChamar('bloqueado');
  usarMinhaLocalizacao(true);
}

function iniciarTimerEsperaCorrida() {
  const regras = obterRegrasMapa();
  let tempoRestante = regras.tempo_espera_segundos;
  const display = document.getElementById('timer-regressivo');

  if (timerIntervalId) clearInterval(timerIntervalId);

  const atualizarDisplay = () => {
    const minutos = Math.floor(tempoRestante / 60);
    const segundos = tempoRestante % 60;
    display.innerText = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
  };

  atualizarDisplay();

  timerIntervalId = setInterval(async () => {
    tempoRestante--;
    atualizarDisplay();

    if (tempoRestante <= 0) {
      clearInterval(timerIntervalId);
      const minsTexto = Math.ceil(regras.tempo_espera_segundos / 60);
      mostrarModal('Tempo Esgotado', `Tempo limite de ${minsTexto} minuto(s) esgotado sem motoristas aceitarem.`, 'cancelar', 4000);

      if (corridaAtualId && supabaseMapa) {
        await supabaseMapa.from('corridas').update({ status: 'expirado' }).eq('id', corridaAtualId);
      }
      resetarPainelCompletoPassageiro();
    }
  }, 1000);
}

async function cancelarBuscaCorrida() {
  if (timerIntervalId) clearInterval(timerIntervalId);

  if (corridaAtualId && supabaseMapa) {
    await supabaseMapa.from('corridas').update({ status: 'cancelado' }).eq('id', corridaAtualId);
  }

  mostrarModal('Cancelado', 'Corrida cancelada com sucesso.', 'cancelar', 3000);
  resetarPainelCompletoPassageiro();
}