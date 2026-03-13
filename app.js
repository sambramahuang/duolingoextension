(function () {
  var mock = window.MediaMentorMock;
  var form = document.getElementById("analysis-form");
  var urlInput = document.getElementById("video-url");
  var fileInput = document.getElementById("video-file");
  var fileName = document.getElementById("file-name");
  var targetLanguage = document.getElementById("target-language");
  var learnerLevel = document.getElementById("learner-level");
  var learningGoal = document.getElementById("learning-goal");
  var statusBadge = document.getElementById("sync-status");
  var resultTitle = document.getElementById("result-title");
  var scoreOrb = document.getElementById("score-orb");
  var resultMeta = document.getElementById("result-meta");
  var resultSummary = document.getElementById("result-summary");
  var metricGrid = document.getElementById("metric-grid");
  var strengthList = document.getElementById("strength-list");
  var cautionList = document.getElementById("caution-list");
  var nextStepList = document.getElementById("next-step-list");
  var demoList = document.getElementById("demo-list");

  function fillSelect(select, options) {
    select.innerHTML = options
      .map(function (item) {
        return '<option value="' + item.value + '">' + item.label + "</option>";
      })
      .join("");
  }

  function renderList(container, items) {
    container.innerHTML = items
      .map(function (item) {
        return "<li>" + item + "</li>";
      })
      .join("");
  }

  function renderMetrics(metrics) {
    metricGrid.innerHTML = metrics
      .map(function (metric) {
        return (
          '<article class="metric-card">' +
          "<header><span>" +
          metric.label +
          "</span><strong>" +
          metric.value +
          "</strong></header>" +
          '<div class="meter"><span style="width:' +
          metric.value +
          '%"></span></div>' +
          "</article>"
        );
      })
      .join("");
  }

  function renderMeta(meta) {
    resultMeta.innerHTML = meta
      .map(function (item) {
        return "<span>" + item + "</span>";
      })
      .join("");
  }

  function getTone(score) {
    if (score >= 80) {
      return {
        text: "Strong match",
        background: "rgba(108, 191, 89, 0.18)",
        color: "#2f5d39"
      };
    }
    if (score >= 65) {
      return {
        text: "Usable with support",
        background: "rgba(240, 181, 65, 0.18)",
        color: "#7d5510"
      };
    }
    return {
      text: "Needs scaffolding",
      background: "rgba(234, 139, 117, 0.18)",
      color: "#8a3d29"
    };
  }

  function applyTone(score) {
    var tone = getTone(score);
    statusBadge.textContent = tone.text;
    statusBadge.style.background = tone.background;
    statusBadge.style.color = tone.color;
  }

  function renderResult(result) {
    resultTitle.textContent = result.title;
    scoreOrb.textContent = result.score;
    resultSummary.textContent = result.summary;
    renderMeta(result.meta);
    renderMetrics(result.metrics);
    renderList(strengthList, result.strengths);
    renderList(cautionList, result.cautions);
    renderList(nextStepList, result.nextSteps);
    applyTone(result.score);
  }

  function setFileLabel() {
    var selectedFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    fileName.textContent = selectedFile ? selectedFile.name : "No file selected";
  }

  function buildPayload() {
    var selectedFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    return {
      url: urlInput.value.trim(),
      fileName: selectedFile ? selectedFile.name : "",
      targetLanguage: targetLanguage.value,
      learnerLevel: learnerLevel.value,
      goal: learningGoal.value
    };
  }

  function buildDemoCard(item) {
    return (
      '<article class="demo-card" data-demo-id="' +
      item.id +
      '">' +
      "<div>" +
      "<h3>" +
      item.title +
      "</h3>" +
      "<p>" +
      item.description +
      "</p>" +
      "</div>" +
      '<div class="tag-row">' +
      item.tags
        .slice(0, 3)
        .map(function (tag) {
          return '<span class="tag">' + tag + "</span>";
        })
        .join("") +
      "</div>" +
      "<button type=\"button\">Analyze this demo</button>" +
      "</article>"
    );
  }

  function renderDemos() {
    demoList.innerHTML = mock.demoVideos.map(buildDemoCard).join("");

    demoList.addEventListener("click", function (event) {
      var card = event.target.closest(".demo-card");
      if (!card || event.target.tagName !== "BUTTON") {
        return;
      }

      var item = mock.demoVideos.find(function (demo) {
        return demo.id === card.dataset.demoId;
      });

      if (!item) {
        return;
      }

      var analysis = mock.convertDemoToAnalysis(item);
      targetLanguage.value = analysis.targetLanguage;
      learnerLevel.value = analysis.learnerLevel;
      learningGoal.value = analysis.goal;
      urlInput.value = item.sourceUrl;
      fileInput.value = "";
      setFileLabel();
      renderResult(analysis);
      mock.saveLatestAnalysis(analysis);
      window.location.hash = "workspace";
    });
  }

  function submitAnalysis(event) {
    event.preventDefault();
    var payload = buildPayload();
    var hasInput = payload.url || payload.fileName;

    if (!hasInput) {
      statusBadge.textContent = "Add a link or file";
      statusBadge.style.background = "rgba(234, 139, 117, 0.18)";
      statusBadge.style.color = "#8a3d29";
      return;
    }

    var result = mock.analyzeSubmission(payload);
    renderResult(result);
    mock.saveLatestAnalysis(result);
  }

  function initialize() {
    fillSelect(targetLanguage, mock.languages);
    fillSelect(learnerLevel, mock.levels);
    fillSelect(learningGoal, mock.goals);
    targetLanguage.value = "spanish";
    learnerLevel.value = "a2";
    learningGoal.value = "conversation";

    renderDemos();
    fileInput.addEventListener("change", setFileLabel);
    form.addEventListener("submit", submitAnalysis);

    mock.loadLatestAnalysis().then(function (analysis) {
      if (analysis) {
        renderResult(analysis);
      }
    });
  }

  initialize();
})();
