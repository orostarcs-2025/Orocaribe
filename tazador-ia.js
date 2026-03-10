(function() {
  var sectionEl = document.querySelector('[id^="orocaribe-tazador-"]');
  if (!sectionEl || !sectionEl.id) return;
  var sectionId = sectionEl.id.replace('orocaribe-tazador-', '');
  var apiKey = (sectionEl.getAttribute('data-api-key') || '').trim();
  var whatsappNumber = (sectionEl.getAttribute('data-whatsapp') || '18495071819').trim();

  var tipoProducto = 'joyas';
  var imagenesSubidas = [];
  var imagenEscaneoBase64 = null;
  var imagenEscaneoMime = 'image/jpeg';

  function getEl(id) { return document.getElementById(id); }
  var previewEl = getEl('scan-preview-' + sectionId);
  var previewImg = getEl('scan-preview-img-' + sectionId);
  var analyzeBtn = getEl('analyze-btn-' + sectionId);
  var loadingOverlay = getEl('ia-loading-' + sectionId);
  var iaBadge = getEl('ia-badge-' + sectionId);

  function setScanImage(file) {
    if (!file || !file.type.startsWith('image/')) return;
    imagenEscaneoMime = file.type;
    var reader = new FileReader();
    reader.onload = function(e) {
      imagenEscaneoBase64 = e.target.result.split(',')[1];
      previewImg.src = e.target.result;
      previewEl.classList.add('visible');
      analyzeBtn.disabled = !apiKey;
    };
    reader.readAsDataURL(file);
  }

  if (getEl('scan-file-' + sectionId)) getEl('scan-file-' + sectionId).addEventListener('change', function() { setScanImage(this.files[0]); });
  if (getEl('scan-camera-' + sectionId)) getEl('scan-camera-' + sectionId).addEventListener('change', function() { setScanImage(this.files[0]); });

  var productBtns = sectionEl.querySelectorAll('.product-btn');
  for (var p = 0; p < productBtns.length; p++) {
    productBtns[p].addEventListener('click', function() {
      tipoProducto = this.getAttribute('data-type');
      var allBtns = sectionEl.querySelectorAll('.product-btn');
      for (var b = 0; b < allBtns.length; b++) allBtns[b].classList.remove('active');
      this.classList.add('active');
    });
  }
  if (getEl('btnJoyas-' + sectionId)) getEl('btnJoyas-' + sectionId).classList.add('active');

  var SYSTEM_PROMPT = "Eres un experto tasador de joyeria para Oro Caribe. Analiza la imagen de la joya y responde UNICAMENTE con un JSON valido, sin markdown ni texto extra, con estas claves: tipoJoya (Anillo, Cadena, Pulsera, Aretes, Dije, Reloj, Otro), colorMetal (Oro amarillo, Oro blanco, Oro rosa o Plata), quilates (10k, 14k Nacional, 14k Italiano, 18k Nacional, 18k Italiano, 22k, 24k), estado (Nuevo, Excelente, Bueno, Regular, Para fundir), descripcionBreve (frase corta). Responde solo el JSON.";

  function normalizeQuilates(val) {
    if (!val) return '';
    var v = (val + '').toLowerCase().replace(/\s/g, ' ');
    var map = { '10k': '10k', '10 k': '10k', '14k nacional': '14k Nacional', '14knacional': '14k Nacional', '14k italiano': '14k Italiano', '14kitaliano': '14k Italiano', '18k nacional': '18k Nacional', '18knacional': '18k Nacional', '18k italiano': '18k Italiano', '18kitaliano': '18k Italiano', '750': '18k Italiano', '22k': '22k', '22 k': '22k', '24k': '24k', '24 k': '24k' };
    return map[v] || map[v.replace(' ', '')] || val;
  }

  function normalizeEstado(val) {
    if (!val) return '';
    var v = (val + '').toLowerCase();
    var opts = ['Nuevo', 'Excelente', 'Bueno', 'Regular', 'Para fundir'];
    for (var o = 0; o < opts.length; o++) {
      var optVal = opts[o];
      if (optVal.toLowerCase() === v || optVal.toLowerCase().replace(/\s/g, '') === v.replace(/\s/g, '')) return optVal;
    }
    if (/excelente|excellent/i.test(v)) return 'Excelente';
    if (/bueno|good/i.test(v)) return 'Bueno';
    if (/regular/i.test(v)) return 'Regular';
    if (/fundir|fundicion/i.test(v)) return 'Para fundir';
    if (/nuevo|new/i.test(v)) return 'Nuevo';
    return val;
  }

  function normalizeTipoJoya(val) {
    if (!val) return '';
    var v = (val + '').toLowerCase();
    var opts = ['Anillo', 'Cadena', 'Pulsera', 'Aretes', 'Dije', 'Reloj', 'Otro'];
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].toLowerCase() === v) return opts[i];
    }
    if (/anillo|ring/i.test(v)) return 'Anillo';
    if (/cadena|chain/i.test(v)) return 'Cadena';
    if (/pulsera|bracelet/i.test(v)) return 'Pulsera';
    if (/arete|aretes|pendiente|earring/i.test(v)) return 'Aretes';
    if (/dije|charm/i.test(v)) return 'Dije';
    if (/reloj|watch/i.test(v)) return 'Reloj';
    return 'Otro';
  }

  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async function() {
      if (!imagenEscaneoBase64 || !apiKey) return;
      loadingOverlay.classList.add('visible');
      analyzeBtn.disabled = true;
      try {
        var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + encodeURIComponent(apiKey);
        var body = { systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }, contents: [{ parts: [{ text: 'Analiza esta imagen de joyeria y devuelve el JSON con tipoJoya, colorMetal, quilates, estado y descripcionBreve.' }, { inlineData: { mimeType: imagenEscaneoMime, data: imagenEscaneoBase64 } }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 512, responseMimeType: 'application/json' } };
        var res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error('Error en la API');
        var data = await res.json();
        var text = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) ? data.candidates[0].content.parts[0].text : null;
        if (!text) throw new Error('Sin respuesta de la IA');
        var json = {};
        try { json = JSON.parse(text.trim()); } catch (e) {
          var re = new RegExp('\\{[\\s\\S]*\\}');
          var match = text.match(re);
          if (match) json = JSON.parse(match[0]);
        }
        var tipoJoya = normalizeTipoJoya(json.tipoJoya);
        var estado = normalizeEstado(json.estado);
        var kilates = normalizeQuilates(json.quilates);
        var descripcion = (json.descripcionBreve || json.colorMetal || '') + (json.descripcionBreve && json.colorMetal ? ' | Color: ' + json.colorMetal : '');
        if (tipoJoya && getEl('tipoJoya-' + sectionId)) getEl('tipoJoya-' + sectionId).value = tipoJoya;
        if (estado && getEl('estado-' + sectionId)) getEl('estado-' + sectionId).value = estado;
        if (kilates && getEl('kilates-' + sectionId)) getEl('kilates-' + sectionId).value = kilates;
        if (descripcion && getEl('descripcion-' + sectionId)) getEl('descripcion-' + sectionId).value = descripcion.trim();
        if (iaBadge) iaBadge.style.display = 'inline-block';
      } catch (err) {
        console.error(err);
        alert('No se pudo analizar la imagen. Revisa tu conexión y la API Key. Puedes llenar el formulario manualmente.');
      } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('visible');
        if (analyzeBtn) analyzeBtn.disabled = false;
      }
    });
  }

  function handleImages(e) {
    var archivos = Array.from(e.target.files);
    var container = getEl('previews-' + sectionId);
    if (!container) return;
    for (var a = 0; a < archivos.length; a++) {
      var archivo = archivos[a];
      if (!archivo.type.startsWith('image/')) continue;
      var reader = new FileReader();
      reader.onload = (function(arch) {
        return function(e) {
          imagenesSubidas.push({ nombre: arch.name, data: e.target.result });
          var div = document.createElement('div');
          div.className = 'preview-item';
          div.innerHTML = '<img src="' + e.target.result + '" alt="Preview" /><button class="remove-btn" type="button">×</button>';
          div.querySelector('.remove-btn').addEventListener('click', function() {
            var idx = Array.prototype.indexOf.call(container.children, div);
            if (idx !== -1) imagenesSubidas.splice(idx, 1);
            div.remove();
          });
          container.appendChild(div);
        };
      })(archivo);
      reader.readAsDataURL(archivo);
    }
  }

  if (getEl('imagenes-' + sectionId)) getEl('imagenes-' + sectionId).addEventListener('change', handleImages);

  if (getEl('formCotizar-' + sectionId)) {
    getEl('formCotizar-' + sectionId).addEventListener('submit', function(e) {
      e.preventDefault();
      var nombre = (getEl('nombres-' + sectionId).value + ' ' + getEl('apellidos-' + sectionId).value).trim();
      var tipo = getEl('tipoJoya-' + sectionId).value || 'No indicado';
      var metal = (getEl('descripcion-' + sectionId).value || 'No indicado').replace(/\n/g, ' ');
      var quilates = getEl('kilates-' + sectionId).value || 'No indicado';
      var estado = getEl('estado-' + sectionId).value || 'No indicado';
      var peso = getEl('gramos-' + sectionId).value || '—';
      var msg = 'Hola Oro Caribe, mi nombre es ' + nombre + '. Me gustaría tasar una joya con las siguientes características detectadas por su IA:\n\nTipo: ' + tipo + '\n\nMetal: ' + metal + '\n\nQuilates: ' + quilates + '\n\nEstado: ' + estado + '\n\nPeso estimado: ' + peso + ' g\n\n¿Podrían darme una valoración preliminar?';
      var waUrl = 'https://api.whatsapp.com/send/?phone=' + whatsappNumber + '&text=' + encodeURIComponent(msg) + '&type=phone_number&app_absent=0';
      window.open(waUrl, '_blank');
      if (imagenesSubidas.length > 0) alert('Se abrirá WhatsApp. Recuerda enviar las ' + imagenesSubidas.length + ' imagen(es) en el chat para completar tu tasación.');
    });
  }
})();
