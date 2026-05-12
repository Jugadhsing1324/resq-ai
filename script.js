const GEMINI_API_KEY = "AIzaSyCsT4pn2wV8Iaw0YFRKgXWM3TyoT9OOi-8"; // <-- Replace this

const GEMINI_MODEL = "gemini-3.1-flash-lite";

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

let selectedImageData = null;   // base64 string (without prefix)
let selectedImageMime = null;   // e.g. "image/jpeg"

const SYSTEM_PROMPT = `
You are ResQ AI — a professional emergency intelligence assistant.
A user will describe an emergency situation. They may also provide a photo of the scene — if so, use the visual context to improve your assessment.

Your job is to:
1. Identify the type of emergency (using both text and image if provided)
2. Assess the severity (Low, Moderate, High, or Critical)
3. Provide clear, numbered immediate actions to take RIGHT NOW
4. Provide additional safety advice
5. Identify which emergency service to call

You MUST respond in valid JSON format and nothing else.
Do NOT include any text outside the JSON block.
Do NOT use markdown code fences like \`\`\`json.

Return EXACTLY this JSON structure:
{
  "emergencyType": "short label like 'Kitchen Fire' or 'Cardiac Emergency'",
  "severity": "Low" or "Moderate" or "High" or "Critical",
  "immediateActions": [
    "First action to take",
    "Second action to take",
    "Third action to take",
    "Fourth action if needed"
  ],
  "safetyAdvice": [
    "Helpful safety tip one",
    "Helpful safety tip two",
    "Helpful safety tip three"
  ],
  "recommendedService": "Ambulance / Police / Fire Brigade / Multiple Services"
}
`.trim();

const loadingMessages = [
  "Analyzing emergency situation...",
  "Detecting hazard severity...",
  "Generating AI safety guidance...",
  "Preparing structured response..."
];

async function analyzeEmergency() {

  const input = document.getElementById("emergencyInput").value.trim();

  if (!input) {
    shakeTextarea();
    return;
  }
  if (input.length < 10) {
    alert("Please describe the situation in more detail.");
    return;
  }

  if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
    showError("API key not set. Please open script.js and replace YOUR_GEMINI_API_KEY_HERE with your Gemini API key.");
    return;
  }

  showLoading();

  try {

    const userParts = [];

    if (selectedImageData && selectedImageMime) {
      userParts.push({
        inline_data: {
          mime_type: selectedImageMime,
          data: selectedImageData
        }
      });
    }

    userParts.push({ text: input });

    const requestBody = {
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }]
      },
      contents: [
        {
          role: "user",
          parts: userParts
        }
      ],
      generationConfig: {
        temperature: 0.4,    // Lower = more focused and consistent
        maxOutputTokens: 800 // Enough for the JSON response
      }
    };

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData?.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error("No response received from Gemini.");
    }

    const result = parseGeminiJSON(rawText);

    displayResults(result);

  } catch (error) {
    console.error("ResQ AI Error:", error);
    showError(error.message || "An unexpected error occurred. Please try again.");
  }
}

function parseGeminiJSON(rawText) {
  let cleanText = rawText.trim();

  cleanText = cleanText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

  const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not find valid JSON in the AI response.");
  }

  return JSON.parse(jsonMatch[0]);
}

function handleImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Please select a valid image file.");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert("Image is too large. Please choose one under 5MB.");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const dataUrl = e.target.result;

    selectedImageMime = file.type;
    selectedImageData = dataUrl.split(",")[1]; // strip the "data:image/...;base64," prefix

    document.getElementById("imgPreview").src = dataUrl;
    document.getElementById("imgPreviewWrap").style.display = "block";

    document.getElementById("imgUploadBtn").classList.add("has-image");
  };
  reader.readAsDataURL(file);

  event.target.value = "";
}

function removeImage() {
  selectedImageData = null;
  selectedImageMime = null;
  document.getElementById("imgPreview").src = "";
  document.getElementById("imgPreviewWrap").style.display = "none";
  document.getElementById("imgUploadBtn").classList.remove("has-image");
}

function displayResults(data) {

  document.getElementById("loadingCard").style.display = "none";

  const resultSection = document.getElementById("resultSection");
  resultSection.style.display = "flex";
  resultSection.style.flexDirection = "column";
  resultSection.style.gap = "20px";

  const severity = (data.severity || "low").toLowerCase();

  updateSeverityMeter(severity);

  document.getElementById("emergencyType").textContent = data.emergencyType || "Unknown";

  document.getElementById("recommendedService").textContent = data.recommendedService || "—";

  const actionsEl = document.getElementById("immediateActions");
  actionsEl.innerHTML = "";
  const actions = Array.isArray(data.immediateActions) ? data.immediateActions : [];
  actions.forEach((action, i) => {
    const li = document.createElement("li");
    li.setAttribute("data-num", i + 1);
    li.textContent = action;
    li.style.animationDelay = `${i * 0.08}s`;
    actionsEl.appendChild(li);
  });

  const adviceEl = document.getElementById("safetyAdvice");
  adviceEl.innerHTML = "";
  const advice = Array.isArray(data.safetyAdvice) ? data.safetyAdvice : [];
  advice.forEach((tip, i) => {
    const li = document.createElement("li");
    li.textContent = tip;
    li.style.animationDelay = `${i * 0.08}s`;
    adviceEl.appendChild(li);
  });

  setTimeout(() => {
    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);
}

function updateSeverityMeter(severity) {
  const validLevels = ["low", "moderate", "high", "critical"];
  const level = validLevels.includes(severity) ? severity : "low";

  const badge = document.getElementById("severityBadge");
  badge.textContent = level.charAt(0).toUpperCase() + level.slice(1);
  badge.className = `severity-badge ${level}`;

  const fill = document.getElementById("meterFill");
  fill.className = `meter-fill ${level}`;

  const levelIndex = { low: 1, moderate: 2, high: 3, critical: 4 };
  const activeDotCount = levelIndex[level] || 1;

  document.querySelectorAll(".meter-dots .dot").forEach((dot, i) => {
    dot.className = "dot"; // Reset
    if (i < activeDotCount) {
      dot.classList.add(`active-${level}`);
    }
  });
}

function showLoading() {

  document.getElementById("analyzeBtn").disabled = true;

  document.getElementById("resultSection").style.display = "none";
  document.getElementById("errorCard").style.display = "none";

  const loadingCard = document.getElementById("loadingCard");
  loadingCard.style.display = "block";

  let msgIndex = 0;
  const loadingText = document.getElementById("loadingText");
  const loadingFill = document.getElementById("loadingFill");

  loadingText.textContent = loadingMessages[0];
  loadingFill.style.width = "10%";

  window._loadingInterval = setInterval(() => {
    msgIndex++;
    if (msgIndex < loadingMessages.length) {
      loadingText.textContent = loadingMessages[msgIndex];
      loadingFill.style.width = `${(msgIndex + 1) * 25}%`;
    }
  }, 900);
}

function showError(message) {

  clearInterval(window._loadingInterval);
  document.getElementById("loadingCard").style.display = "none";
  document.getElementById("analyzeBtn").disabled = false;

  const errorCard = document.getElementById("errorCard");
  document.getElementById("errorMsg").textContent = message;
  errorCard.style.display = "block";

  errorCard.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetAnalyzer() {
  clearInterval(window._loadingInterval);

  document.getElementById("resultSection").style.display = "none";
  document.getElementById("errorCard").style.display = "none";
  document.getElementById("loadingCard").style.display = "none";
  document.getElementById("analyzeBtn").disabled = false;
  document.getElementById("emergencyInput").focus();

  removeImage();

  document.getElementById("analyzer").scrollIntoView({ behavior: "smooth" });
}

function shakeTextarea() {
  const textarea = document.getElementById("emergencyInput");
  textarea.style.animation = "none";
  textarea.style.borderColor = "rgba(255,61,46,0.7)";
  textarea.style.boxShadow = "0 0 0 3px rgba(255,61,46,0.2)";

  setTimeout(() => {
    textarea.style.borderColor = "";
    textarea.style.boxShadow = "";
  }, 1200);

  textarea.focus();
}

document.getElementById("emergencyInput").addEventListener("input", function () {
  const count = this.value.length;
  const max = 1000;
  const counter = document.getElementById("charCount");

  if (count > max) {
    this.value = this.value.substring(0, max);
    return;
  }

  counter.textContent = `${count} / ${max} characters`;
  counter.style.color = count > 800 ? "var(--orange)" : "var(--text-dim)";
});

document.getElementById("emergencyInput").addEventListener("keydown", function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    analyzeEmergency();
  }
});

window.addEventListener("scroll", () => {
  const navbar = document.querySelector(".navbar");
  if (window.scrollY > 40) {
    navbar.style.boxShadow = "0 4px 24px rgba(0,0,0,0.5)";
  } else {
    navbar.style.boxShadow = "none";
  }
});

function openCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    document.getElementById("cameraInput").click();
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = "camOverlay";
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    background:rgba(0,0,0,0.92);
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;
  `;

  const video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  video.style.cssText = `
    max-width:min(94vw,640px);max-height:60vh;
    border:3px solid #c8102e;box-shadow:5px 5px 0 #000;
    display:block;background:#000;
  `;

  const btnRow = document.createElement("div");
  btnRow.style.cssText = "display:flex;gap:14px;flex-wrap:wrap;justify-content:center;";

  const snapBtn = document.createElement("button");
  snapBtn.textContent = "📸  CAPTURE";
  snapBtn.style.cssText = `
    font-family:'Bangers',sans-serif;font-size:16px;letter-spacing:2.5px;
    background:#c8102e;color:#fff;border:3px solid #000;padding:12px 32px;
    cursor:pointer;box-shadow:4px 4px 0 #000;text-transform:uppercase;
    clip-path:polygon(0 0,calc(100% - 12px) 0,100% 100%,12px 100%);
  `;

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "✕  CANCEL";
  cancelBtn.style.cssText = `
    font-family:'Bangers',sans-serif;font-size:14px;letter-spacing:2px;
    background:transparent;color:#8a8070;border:2px solid rgba(200,16,46,0.3);
    padding:12px 24px;cursor:pointer;box-shadow:2px 2px 0 #000;text-transform:uppercase;
  `;

  btnRow.appendChild(snapBtn);
  btnRow.appendChild(cancelBtn);
  overlay.appendChild(video);
  overlay.appendChild(btnRow);
  document.body.appendChild(overlay);

  let stream = null;

  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
    .then(s => {
      stream = s;
      video.srcObject = s;
    })
    .catch(() => {

      closeOverlay();
      document.getElementById("cameraInput").click();
    });

  function closeOverlay() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    overlay.remove();
  }

  snapBtn.onclick = function() {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
      const dt = new DataTransfer();
      dt.items.add(file);
      const fakeEvt = { target: { files: dt.files, value: "" } };
      handleImageSelect(fakeEvt);
    }, "image/jpeg", 0.92);
    closeOverlay();
  };

  cancelBtn.onclick = closeOverlay;
  overlay.addEventListener("click", e => { if (e.target === overlay) closeOverlay(); });
}

function copyNumber(event, number) {

  event.preventDefault();
  event.stopPropagation();

  navigator.clipboard.writeText(number).then(() => {
    showCopyToast();
  }).catch(() => {

    const el = document.createElement("textarea");
    el.value = number;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    showCopyToast();
  });
}

function showCopyToast() {
  const toast = document.getElementById("copyToast");
  toast.classList.add("show");
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.remove("show"), 2000);
}

const CITY_DATA = {
  ludhiana: {
    display: "Ludhiana",
    hospitals: [
      { name: "Dayanand Medical College & Hospital", addr: "Tagore Nagar, Civil Lines, Ludhiana, Punjab 141001" },
      { name: "Civil Hospital Ludhiana", addr: "Near Bus Stand, Ferozepur Road, Ludhiana, Punjab 141001" },
      { name: "SPS Hospital", addr: "Sherpur Chowk, GT Road, Ludhiana, Punjab 141003" },
      { name: "Fortis Hospital Ludhiana", addr: "Chandigarh Road, Ludhiana, Punjab 141010" },
      { name: "Christian Medical College", addr: "Brown Road, Ludhiana, Punjab 141008" }
    ],
    police: [
      { name: "Ludhiana Police Commissionerate", addr: "Ferozepur Road, Near Bus Stand, Ludhiana, Punjab 141001" },
      { name: "Division No. 3 Police Station", addr: "Gill Road, Ludhiana, Punjab 141003" },
      { name: "Sadar Police Station", addr: "Model Town Extension, Ludhiana, Punjab 141002" },
      { name: "Division No. 7 Police Station", addr: "Pakhowal Road, Ludhiana, Punjab 141013" }
    ],
    fire: [
      { name: "Ludhiana Fire Station (Central)", addr: "Near Ghanta Ghar, Civil Lines, Ludhiana, Punjab 141001" },
      { name: "Fire Station (Focal Point)", addr: "Focal Point, Phase-8, Ludhiana, Punjab 141010" },
      { name: "Fire Station (Sahnewal)", addr: "Sahnewal, Ludhiana, Punjab 141120" }
    ]
  },
  delhi: {
    display: "Delhi",
    hospitals: [
      { name: "All India Institute of Medical Sciences (AIIMS)", addr: "Sri Aurobindo Marg, Ansari Nagar, New Delhi 110029" },
      { name: "Safdarjung Hospital", addr: "Ansari Nagar West, New Delhi 110029" },
      { name: "Ram Manohar Lohia Hospital", addr: "Baba Kharak Singh Marg, New Delhi 110001" },
      { name: "Max Super Speciality Hospital Saket", addr: "2 Press Enclave Road, Saket, New Delhi 110017" },
      { name: "Apollo Hospital Delhi", addr: "Mathura Road, Indraprastha, New Delhi 110076" }
    ],
    police: [
      { name: "Delhi Police Headquarters", addr: "Indraprastha Estate, New Delhi 110002" },
      { name: "Connaught Place Police Station", addr: "Barakhamba Road, New Delhi 110001" },
      { name: "Lajpat Nagar Police Station", addr: "Lajpat Nagar-II, New Delhi 110024" },
      { name: "Dwarka Police Station", addr: "Sector-10, Dwarka, New Delhi 110075" }
    ],
    fire: [
      { name: "Delhi Fire Service HQ", addr: "Connaught Circus, New Delhi 110001" },
      { name: "Fire Station Karol Bagh", addr: "Arya Samaj Road, Karol Bagh, New Delhi 110005" },
      { name: "Fire Station Rohini", addr: "Sector-7, Rohini, New Delhi 110085" }
    ]
  },
  mumbai: {
    display: "Mumbai",
    hospitals: [
      { name: "KEM Hospital", addr: "Acharya Dhonde Marg, Parel, Mumbai 400012" },
      { name: "Lilavati Hospital", addr: "A-791, Bandra Reclamation, Bandra West, Mumbai 400050" },
      { name: "Tata Memorial Hospital", addr: "Dr. Ernest Borges Marg, Parel, Mumbai 400012" },
      { name: "Jaslok Hospital", addr: "15, Dr. Deshmukh Marg, Pedder Road, Mumbai 400026" },
      { name: "Kokilaben Dhirubhai Ambani Hospital", addr: "Rao Saheb Achutrao Patwardhan Marg, Mumbai 400053" }
    ],
    police: [
      { name: "Mumbai Police Commissioner Office", addr: "Crawford Market, Mumbai 400001" },
      { name: "Bandra Police Station", addr: "Mehboob Studio Compound, Bandra West, Mumbai 400050" },
      { name: "Andheri Police Station", addr: "J.B. Nagar, Andheri East, Mumbai 400059" },
      { name: "Colaba Police Station", addr: "Shahid Bhagat Singh Road, Colaba, Mumbai 400001" }
    ],
    fire: [
      { name: "Mumbai Fire Brigade HQ", addr: "Byculla, Mumbai 400027" },
      { name: "Fire Station Dadar", addr: "Dadar West, Mumbai 400028" },
      { name: "Fire Station Andheri", addr: "Andheri East, Mumbai 400093" }
    ]
  },
  bengaluru: {
    display: "Bengaluru",
    hospitals: [
      { name: "Victoria Hospital", addr: "Fort Road, Bengaluru, Karnataka 560002" },
      { name: "Manipal Hospital (HAL Airport Rd)", addr: "98 HAL Airport Road, Bengaluru 560017" },
      { name: "Narayana Health City", addr: "258/A, Bommasandra Industrial Area, Bengaluru 560099" },
      { name: "Sakra World Hospital", addr: "52/2, Devarabeesanahalli, Varthur Hobli, Bengaluru 560103" },
      { name: "St. John's Medical College Hospital", addr: "Sarjapur Road, Bengaluru 560034" }
    ],
    police: [
      { name: "Bengaluru City Police Commissioner", addr: "Infantry Road, Bengaluru 560001" },
      { name: "MG Road Police Station", addr: "MG Road, Bengaluru 560001" },
      { name: "Whitefield Police Station", addr: "ITPL Main Road, Whitefield, Bengaluru 560066" },
      { name: "Koramangala Police Station", addr: "80 Feet Road, Koramangala, Bengaluru 560034" }
    ],
    fire: [
      { name: "Bengaluru Fire Station (Central)", addr: "Nrupathunga Road, Bengaluru 560001" },
      { name: "Fire Station Yeshwantpur", addr: "Tumkur Road, Yeshwantpur, Bengaluru 560022" },
      { name: "Fire Station Electronic City", addr: "Electronic City Phase 1, Bengaluru 560100" }
    ]
  },
  hyderabad: {
    display: "Hyderabad",
    hospitals: [
      { name: "Osmania General Hospital", addr: "Afzalgunj, Hyderabad, Telangana 500012" },
      { name: "Apollo Hospitals Jubilee Hills", addr: "Jubilee Hills, Hyderabad 500033" },
      { name: "NIMS (Nizam's Institute of Medical Sciences)", addr: "Punjagutta, Hyderabad 500082" },
      { name: "Yashoda Hospitals Secunderabad", addr: "S.P. Road, Secunderabad 500003" },
      { name: "Care Hospitals Banjara Hills", addr: "Road No. 1, Banjara Hills, Hyderabad 500034" }
    ],
    police: [
      { name: "Hyderabad City Police HQ", addr: "Purani Haveli, Hyderabad 500002" },
      { name: "Begumpet Police Station", addr: "Begumpet, Hyderabad 500016" },
      { name: "Madhapur Police Station", addr: "HITEC City, Madhapur, Hyderabad 500081" },
      { name: "LB Nagar Police Station", addr: "LB Nagar, Hyderabad 500074" }
    ],
    fire: [
      { name: "Hyderabad Fire Station (Head)", addr: "Moghalpura, Hyderabad 500002" },
      { name: "Fire Station HITEC City", addr: "Cyberabad, Hyderabad 500081" },
      { name: "Fire Station LB Nagar", addr: "LB Nagar, Hyderabad 500074" }
    ]
  },
  chennai: {
    display: "Chennai",
    hospitals: [
      { name: "Government General Hospital Chennai", addr: "Park Town, Chennai, Tamil Nadu 600003" },
      { name: "Apollo Hospitals Greams Road", addr: "21, Greams Lane, Chennai 600006" },
      { name: "Fortis Malar Hospital", addr: "52, 1st Main Road, Gandhi Nagar, Adyar, Chennai 600020" },
      { name: "MIOT International Hospital", addr: "4/112, Mount Poonamallee Road, Manapakkam, Chennai 600089" },
      { name: "Rajiv Gandhi Government General Hospital", addr: "Park Town, Chennai 600003" }
    ],
    police: [
      { name: "Chennai City Police Commissioner", addr: "Vepery, Chennai 600007" },
      { name: "Anna Nagar Police Station", addr: "Anna Nagar, Chennai 600040" },
      { name: "T. Nagar Police Station", addr: "Thyagaraya Nagar, Chennai 600017" },
      { name: "Adyar Police Station", addr: "Adyar, Chennai 600020" }
    ],
    fire: [
      { name: "Chennai Fire Station (Egmore)", addr: "Egmore, Chennai 600008" },
      { name: "Fire Station Anna Nagar", addr: "Anna Nagar, Chennai 600040" },
      { name: "Fire Station Tambaram", addr: "Tambaram, Chennai 600045" }
    ]
  },
  kolkata: {
    display: "Kolkata",
    hospitals: [
      { name: "SSKM Hospital", addr: "244 AJC Bose Road, Kolkata, West Bengal 700020" },
      { name: "Bellevue Clinic", addr: "9 Dr. U.N. Brahmachari Street, Kolkata 700017" },
      { name: "Apollo Gleneagles Hospitals", addr: "58 Canal Circular Road, Kolkata 700054" },
      { name: "Medical College & Hospital Kolkata", addr: "88 College Street, Kolkata 700073" },
      { name: "Fortis Hospital Anandapur", addr: "730 Anandapur, EM Bypass, Kolkata 700107" }
    ],
    police: [
      { name: "Kolkata Police Headquarters", addr: "Lal Bazar Street, Kolkata 700001" },
      { name: "Park Street Police Station", addr: "Park Street, Kolkata 700016" },
      { name: "Lake Police Station", addr: "Rashbehari Avenue, Kolkata 700029" },
      { name: "Salt Lake Police Station", addr: "Sector V, Salt Lake, Kolkata 700091" }
    ],
    fire: [
      { name: "Kolkata Fire Brigade HQ", addr: "2 Mirza Ghalib Street, Kolkata 700087" },
      { name: "Fire Station Salt Lake", addr: "Sector III, Salt Lake, Kolkata 700091" },
      { name: "Fire Station Jadavpur", addr: "Raja SC Mullick Road, Jadavpur, Kolkata 700032" }
    ]
  },
  pune: {
    display: "Pune",
    hospitals: [
      { name: "Sassoon General Hospital", addr: "Near Railway Station, Pune, Maharashtra 411001" },
      { name: "Ruby Hall Clinic", addr: "40, Sassoon Road, Pune 411001" },
      { name: "KEM Hospital Pune", addr: "489, Rasta Peth, Sardar Moodliar Road, Pune 411011" },
      { name: "Jehangir Hospital", addr: "32, Sassoon Road, Pune 411001" },
      { name: "Symbiosis University Hospital", addr: "Gram Lavale, Off Mumbai–Bangalore Expressway, Pune 412115" }
    ],
    police: [
      { name: "Pune Police Commissioner Office", addr: "11, Commissariat Road, Pune 411001" },
      { name: "Shivajinagar Police Station", addr: "FC Road, Shivajinagar, Pune 411005" },
      { name: "Hadapsar Police Station", addr: "Hadapsar, Pune 411028" },
      { name: "Kothrud Police Station", addr: "Kothrud, Pune 411038" }
    ],
    fire: [
      { name: "Pune Fire Brigade HQ", addr: "Kasba Peth, Pune 411011" },
      { name: "Fire Station Hadapsar", addr: "Hadapsar, Pune 411028" },
      { name: "Fire Station Pimpri", addr: "Pimpri, Pune 411018" }
    ]
  },
  ahmedabad: {
    display: "Ahmedabad",
    hospitals: [
      { name: "Civil Hospital Ahmedabad", addr: "Asarwa, Ahmedabad, Gujarat 380016" },
      { name: "Apollo Hospitals Ahmedabad", addr: "Plot 1A, BHAT, SG Highway, Ahmedabad 382428" },
      { name: "Sterling Hospital", addr: "Memnagar, Ahmedabad 380052" },
      { name: "VS General Hospital", addr: "Ellisbridge, Ahmedabad 380006" },
      { name: "SAL Hospital", addr: "Drive-in Road, Bodakdev, Ahmedabad 380054" }
    ],
    police: [
      { name: "Ahmedabad Police Commissioner", addr: "Shahibaug, Ahmedabad 380004" },
      { name: "Navrangpura Police Station", addr: "Navrangpura, Ahmedabad 380009" },
      { name: "Maninagar Police Station", addr: "Maninagar, Ahmedabad 380008" },
      { name: "Satellite Police Station", addr: "Satellite Road, Ahmedabad 380015" }
    ],
    fire: [
      { name: "Ahmedabad Fire Station (Central)", addr: "Danapith, Ahmedabad 380001" },
      { name: "Fire Station Narol", addr: "Narol Circle, Ahmedabad 382405" },
      { name: "Fire Station Bopal", addr: "Bopal, Ahmedabad 380058" }
    ]
  },
  jaipur: {
    display: "Jaipur",
    hospitals: [
      { name: "SMS Hospital Jaipur", addr: "Jawahar Lal Nehru Marg, Jaipur, Rajasthan 302004" },
      { name: "Fortis Escorts Hospital Jaipur", addr: "JLN Marg, Malviya Nagar, Jaipur 302017" },
      { name: "Narayana Multispeciality Hospital", addr: "Sector 28, Pratap Nagar, Jaipur 302033" },
      { name: "Santokba Durlabhji Memorial Hospital", addr: "Bhawani Singh Road, Jaipur 302015" }
    ],
    police: [
      { name: "Jaipur Police Commissioner", addr: "Raja Park, Jaipur 302004" },
      { name: "Mansarovar Police Station", addr: "Mansarovar, Jaipur 302020" },
      { name: "MI Road Police Station", addr: "MI Road, Jaipur 302001" }
    ],
    fire: [
      { name: "Jaipur Fire Station (Central)", addr: "Jalupura, Jaipur 302005" },
      { name: "Fire Station Vaishali Nagar", addr: "Vaishali Nagar, Jaipur 302021" }
    ]
  }
};

function searchNearby() {
  const raw = document.getElementById("cityInput").value.trim().toLowerCase();

  document.getElementById("nearbyResults").style.display = "none";
  document.getElementById("nearbyNotFound").style.display = "none";

  if (!raw) return;

  const key = Object.keys(CITY_DATA).find(k => k.includes(raw) || raw.includes(k));

  if (!key) {
    document.getElementById("nearbyNotFound").style.display = "block";
    document.getElementById("nearbyNotFound").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const city = CITY_DATA[key];

  document.getElementById("nearbyCityName").textContent = city.display;

  const cols = document.getElementById("nearbyCols");
  cols.innerHTML = "";

  const categories = [
    { key: "hospitals", label: "Hospitals",       icon: "🏥", cls: "hosp"   },
    { key: "police",    label: "Police Stations",  icon: "🚔", cls: "police" },
    { key: "fire",      label: "Fire Stations",    icon: "🚒", cls: "fire"   }
  ];

  categories.forEach(cat => {
    const col = document.createElement("div");
    col.className = "nearby-col";

    const header = document.createElement("div");
    header.className = `nearby-col-header ${cat.cls}`;
    header.innerHTML = `<span class="nearby-col-icon">${cat.icon}</span>${cat.label}`;
    col.appendChild(header);

    city[cat.key].forEach(place => {
      const card = document.createElement("div");
      card.className = `nearby-place-card ${cat.cls}`;
      card.innerHTML = `
        <div class="nearby-place-name">${place.name}</div>
        <div class="nearby-place-addr">${place.addr}</div>
      `;
      col.appendChild(card);
    });

    cols.appendChild(col);
  });

  document.getElementById("nearbyResults").style.display = "block";
  setTimeout(() => {
    document.getElementById("nearbyResults").scrollIntoView({ behavior: "smooth", block: "start" });
  }, 80);
}

document.getElementById("cityInput").addEventListener("keydown", function(e) {
  if (e.key === "Enter") searchNearby();
});

let voiceRecognition = null;
let voiceListening = false;

function startVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Voice input is not supported in your browser. Please try Chrome or Edge.");
    return;
  }

  const btn = document.getElementById("voiceBtn");
  const textarea = document.getElementById("emergencyInput");

  if (voiceListening && voiceRecognition) {
    voiceRecognition.stop();
    return;
  }

  voiceRecognition = new SpeechRecognition();
  voiceRecognition.lang = "en-IN";
  voiceRecognition.interimResults = false;
  voiceRecognition.maxAlternatives = 1;
  voiceRecognition.continuous = false;

  voiceRecognition.onstart = function() {
    voiceListening = true;
    btn.classList.add("listening");
    const span = btn.querySelector("span");
    if (span) span.textContent = "STOP";
  };

  voiceRecognition.onresult = function(event) {
    const transcript = event.results[0][0].transcript;
    const existing = textarea.value.trim();
    textarea.value = existing ? existing + " " + transcript : transcript;
    const charCountEl = document.getElementById("charCount");
    if (charCountEl) charCountEl.textContent = textarea.value.length + " / 1000 characters";
  };

  voiceRecognition.onerror = function(event) {
    if (event.error !== "aborted") {
      alert("Voice recognition error: " + event.error + ". Please try again.");
    }
  };

  voiceRecognition.onend = function() {
    voiceListening = false;
    btn.classList.remove("listening");
    const span = btn.querySelector("span");
    if (span) span.textContent = "VOICE";
  };

  voiceRecognition.start();
}
