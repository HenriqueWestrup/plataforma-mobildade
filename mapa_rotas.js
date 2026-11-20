// mapa_rotas.js
function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const dPhi = (lat2 - lat1) * Math.PI / 180;
  const dLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function aoDigitarEndereco(tipo, valor) {
  if (tipo === 'origem') {
    coordsOrigem = null;
    if (marcadorOrigem && mapaLeaflet) {
      mapaLeaflet.removeLayer(marcadorOrigem);
      marcadorOrigem = null;
    }
    atualizarEstadoBotaoChamar('bloqueado', 'Selecione o local de embarque');
  } else if (tipo === 'destino') {
    coordsDestino = null;
    if (marcadorDestino && mapaLeaflet) {
      mapaLeaflet.removeLayer(marcadorDestino);
      marcadorDestino = null;
    }
    atualizarEstadoBotaoChamar('bloqueado', 'Selecione o destino');
  } else if (tipo.startsWith('parada-')) {
    delete coordsParadas[tipo];
    if (marcadoresParadas[tipo] && mapaLeaflet) {
      mapaLeaflet.removeLayer(marcadoresParadas[tipo]);
      delete marcadoresParadas[tipo];
    }
    if (valor.trim() === '') {
      verificarECalcularSePronto();
    } else {
      atualizarEstadoBotaoChamar('bloqueado', 'Selecione o endereço da parada');
    }
  }

  if (timerBuscaDebounced[tipo]) clearTimeout(timerBuscaDebounced[tipo]);
  timerBuscaDebounced[tipo] = setTimeout(() => {
    buscarSugestoes(valor, tipo);
  }, 350);
}

async function buscarSugestoes(termo, tipo) {
  const container = document.getElementById(`sugestoes-${tipo}`);
  if (!container) return;

  if (termo.trim().length < 3) {
    container.classList.add('hidden');
    return;
  }

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(termo)}`);
    const resultados = await res.json();

    if (!resultados || resultados.length === 0) {
      container.classList.add('hidden');
      return;
    }

    container.innerHTML = resultados.map(item => {
      const nomeSeguro = item.display_name.replace(/'/g, '').replace(/"/g, '');
      return `
        <div onclick="selecionarEndereco('${nomeSeguro}', ${item.lat}, ${item.lon}, '${tipo}')" class="p-2.5 hover:bg-slate-800 cursor-pointer border-b border-slate-800 text-slate-200 truncate">
          <i class="fa-solid fa-location-dot text-emerald-400 mr-2"></i> ${item.display_name}
        </div>
      `;
    }).join('');
    container.classList.remove('hidden');
  } catch (e) {}
}

function selecionarEndereco(nome, lat, lon, tipo) {
  const idInput = (tipo === 'origem' || tipo === 'destino') ? `${tipo}-corrida` : tipo;
  const inputEl = document.getElementById(idInput);
  if (inputEl) inputEl.value = nome;

  const sugEl = document.getElementById(`sugestoes-${tipo}`);
  if (sugEl) sugEl.classList.add('hidden');

  const coord = { lat: parseFloat(lat), lng: parseFloat(lon), nome };

  if (tipo === 'origem') {
    coordsOrigem = coord;
    if (marcadorOrigem) mapaLeaflet.removeLayer(marcadorOrigem);
    marcadorOrigem = L.marker([coord.lat, coord.lng]).addTo(mapaLeaflet).bindPopup('Embarque');
  } else if (tipo === 'destino') {
    coordsDestino = coord;
    if (marcadorDestino) mapaLeaflet.removeLayer(marcadorDestino);
    marcadorDestino = L.marker([coord.lat, coord.lng], {
      icon: L.divIcon({ className: 'bg-amber-500 w-3.5 h-3.5 rounded-full border-2 border-white shadow' })
    }).addTo(mapaLeaflet).bindPopup('Destino Final');
  } else if (tipo.startsWith('parada-')) {
    coordsParadas[tipo] = coord;
    if (marcadoresParadas[tipo]) mapaLeaflet.removeLayer(marcadoresParadas[tipo]);
    marcadoresParadas[tipo] = L.marker([coord.lat, coord.lng], {
      icon: L.divIcon({ className: 'bg-sky-400 w-3 h-3 rounded-full border-2 border-white shadow' })
    }).addTo(mapaLeaflet).bindPopup('Parada');
  }

  verificarECalcularSePronto();
}

function adicionarCampoParada() {
  const r = obterRegrasMapa();
  const container = document.getElementById('container-paradas');
  if (container.children.length >= r.max_paradas) {
    mostrarModal('Atenção', `Limite máximo de ${r.max_paradas} parada(s) intermediária(s).`, 'cancelar', 3000);
    return;
  }
  const idParada = 'parada-' + Date.now();
  const div = document.createElement('div');
  div.className = 'relative flex items-center gap-2 bg-slate-950 border border-slate-800 p-2.5 rounded-xl';
  div.innerHTML = `
    <i class="fa-solid fa-stop text-sky-400"></i>
    <input type="text" id="${idParada}" placeholder="Adicionar parada" oninput="aoDigitarEndereco('${idParada}', this.value)" class="w-full bg-transparent text-slate-100 focus:outline-none placeholder-slate-500">
    <button onclick="removerCampoParada('${idParada}', this)" class="text-red-400 hover:text-red-300 px-1"><i class="fa-solid fa-xmark"></i></button>
    <div id="sugestoes-${idParada}" class="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-800 rounded-xl shadow-xl z-30 hidden max-h-36 overflow-y-auto"></div>
  `;
  container.appendChild(div);
}

function removerCampoParada(idParada, btnEl) {
  delete coordsParadas[idParada];
  if (marcadoresParadas[idParada] && mapaLeaflet) {
    mapaLeaflet.removeLayer(marcadoresParadas[idParada]);
    delete marcadoresParadas[idParada];
  }
  btnEl.parentElement.remove();
  verificarECalcularSePronto();
}

function obterListaParadasValidas() {
  const container = document.getElementById('container-paradas');
  if (!container) return [];
  const inputs = container.querySelectorAll('input');
  const lista = [];
  inputs.forEach(inp => {
    const id = inp.id;
    const texto = inp.value.trim();
    if (texto !== '') {
      lista.push({
        id,
        texto,
        coord: coordsParadas[id] || null
      });
    }
  });
  return lista;
}

function verificarECalcularSePronto() {
  const origemTexto = document.getElementById('origem-corrida')?.value.trim();
  const destinoTexto = document.getElementById('destino-corrida')?.value.trim();

  if (!origemTexto || !coordsOrigem) {
    atualizarEstadoBotaoChamar('bloqueado', 'Defina o local de embarque');
    return;
  }

  if (!destinoTexto || !coordsDestino) {
    atualizarEstadoBotaoChamar('bloqueado', 'Defina o destino final');
    return;
  }

  const paradas = obterListaParadasValidas();
  const paradaSemCoord = paradas.find(p => !p.coord);
  if (paradaSemCoord) {
    atualizarEstadoBotaoChamar('bloqueado', 'Selecione o endereço da parada');
    return;
  }

  calcularRotaEValor();
}

function aplicarEstimativaNaTela(distanciaKm, quantidadeParadas, aproximada = false) {
  const calculo = calcularValorCorrida(distanciaKm, quantidadeParadas);
  valorCalculadoAtual = calculo.total;

  document.getElementById('valor-estimado').innerText = `R$ ${calculo.total.toFixed(2).replace('.', ',')}`;
  const prefixo = aproximada ? '~' : '';
  const sufixoParada = quantidadeParadas > 0 ? ` • ${quantidadeParadas} parada(s)` : '';
  document.getElementById('distancia-estimada').innerText = `${prefixo}${distanciaKm.toFixed(1).replace('.', ',')} km${sufixoParada}`;
  document.getElementById('bloco-estimativa').classList.remove('hidden');
}

async function calcularRotaEValor() {
  if (!coordsOrigem || !coordsDestino) return;

  atualizarEstadoBotaoChamar('calculando', 'Calculando rota e valor...');

  const paradasValidas = obterListaParadasValidas();
  const pontosRota = [coordsOrigem, ...paradasValidas.map(p => p.coord), coordsDestino];

  try {
    const coordenadasString = pontosRota.map(p => `${p.lng},${p.lat}`).join(';');
    const urlOsrm = `https://router.project-osrm.org/route/v1/driving/${coordenadasString}?overview=full&geometries=geojson`;
    const res = await fetch(urlOsrm);
    const data = await res.json();

    if (data && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const coordenadasGeo = route.geometry.coordinates.map(c => [c[1], c[0]]);

      if (polylineRota) mapaLeaflet.removeLayer(polylineRota);

      polylineRota = L.polyline(coordenadasGeo, {
        color: '#10b981',
        weight: 5,
        opacity: 0.85
      }).addTo(mapaLeaflet);

      aplicarEstimativaNaTela(route.distance / 1000, paradasValidas.length, false);
      mapaLeaflet.fitBounds(polylineRota.getBounds(), { padding: [60, 60] });
      atualizarEstadoBotaoChamar('pronto');
      return;
    }
  } catch (e) {}

  let distanciaTotalMetros = 0;
  const latLngsLinha = [];
  for (let i = 0; i < pontosRota.length; i++) {
    latLngsLinha.push([pontosRota[i].lat, pontosRota[i].lng]);
    if (i > 0) {
      distanciaTotalMetros += calcularDistanciaMetros(
        pontosRota[i - 1].lat, pontosRota[i - 1].lng,
        pontosRota[i].lat, pontosRota[i].lng
      );
    }
  }

  if (polylineRota) mapaLeaflet.removeLayer(polylineRota);
  polylineRota = L.polyline(latLngsLinha, {
    color: '#10b981',
    weight: 5,
    opacity: 0.85,
    dashArray: '8, 8'
  }).addTo(mapaLeaflet);

  aplicarEstimativaNaTela(distanciaTotalMetros / 1000, paradasValidas.length, true);
  mapaLeaflet.fitBounds(polylineRota.getBounds(), { padding: [50, 50] });
  atualizarEstadoBotaoChamar('pronto');
}