(function () {
  var STORAGE_KEY = "lingolens.latestAnalysis";

  var languages = [
    { value: "spanish", label: "Spanish" },
    { value: "french", label: "French" },
    { value: "japanese", label: "Japanese" },
    { value: "korean", label: "Korean" },
    { value: "german", label: "German" },
    { value: "english", label: "English" }
  ];

  var levels = [
    { value: "a1", label: "A1 Beginner" },
    { value: "a2", label: "A2 Elementary" },
    { value: "b1", label: "B1 Intermediate" },
    { value: "b2", label: "B2 Upper Intermediate" },
    { value: "c1", label: "C1 Advanced" }
  ];

  var goals = [
    { value: "listening", label: "Listening practice" },
    { value: "vocabulary", label: "Vocabulary growth" },
    { value: "pronunciation", label: "Pronunciation mimicry" },
    { value: "conversation", label: "Conversation rhythm" }
  ];

  var demoVideos = [
    {
      id: "madrid-street",
      title: "Ordering Tapas in Madrid",
      sourceUrl: "https://www.tiktok.com/@foodroutes/video/90001",
      platform: "TikTok",
      targetLanguage: "spanish",
      learnerLevel: "a2",
      goal: "conversation",
      description: "Short street interview with clear hospitality phrases and visible captions.",
      tags: ["captions", "daily phrases", "slow speech"],
      duration: "0:48",
      metrics: {
        clarity: 82,
        subtitles: 88,
        levelFit: 91,
        pace: 79,
        retention: 76
      }
    },
    {
      id: "korean-vlog",
      title: "Morning Seoul Cafe Vlog",
      sourceUrl: "https://www.instagram.com/reel/90002",
      platform: "Instagram",
      targetLanguage: "korean",
      learnerLevel: "b1",
      goal: "listening",
      description: "Lifestyle reel with strong visual context, but quick transitions and slang.",
      tags: ["visual context", "vlog", "native slang"],
      duration: "1:05",
      metrics: {
        clarity: 67,
        subtitles: 54,
        levelFit: 71,
        pace: 58,
        retention: 83
      }
    },
    {
      id: "japanese-shadowing",
      title: "Useful Japanese Train Announcements",
      sourceUrl: "https://www.youtube.com/watch?v=90003",
      platform: "YouTube",
      targetLanguage: "japanese",
      learnerLevel: "b1",
      goal: "pronunciation",
      description: "Structured explainer with repeat-after-me pauses and explicit transcript lines.",
      tags: ["repeatable", "formal speech", "transcript"],
      duration: "3:20",
      metrics: {
        clarity: 89,
        subtitles: 84,
        levelFit: 80,
        pace: 72,
        retention: 87
      }
    },
    {
      id: "french-comedy",
      title: "Paris Metro Comedy Sketch",
      sourceUrl: "https://www.tiktok.com/@metrobits/video/90004",
      platform: "TikTok",
      targetLanguage: "french",
      learnerLevel: "b2",
      goal: "vocabulary",
      description: "Entertaining and memorable, but dense slang and punchline speed limit beginner value.",
      tags: ["humor", "fast delivery", "slang"],
      duration: "0:39",
      metrics: {
        clarity: 62,
        subtitles: 59,
        levelFit: 66,
        pace: 46,
        retention: 91
      }
    }
  ];

  function hashString(input) {
    var value = 0;
    for (var index = 0; index < input.length; index += 1) {
      value = (value * 31 + input.charCodeAt(index)) >>> 0;
    }
    return value;
  }

  function clamp(number, min, max) {
    return Math.max(min, Math.min(number, max));
  }

  function toTitleCase(value) {
    if (!value) {
      return "";
    }
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function getStorageArea() {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      return {
        type: "chrome",
        api: chrome.storage.local
      };
    }
    if (typeof window !== "undefined" && window.localStorage) {
      return {
        type: "local",
        api: window.localStorage
      };
    }
    return null;
  }

  function saveLatestAnalysis(result) {
    var storage = getStorageArea();
    if (!storage) {
      return Promise.resolve(result);
    }
    if (storage.type === "local") {
      storage.api.setItem(STORAGE_KEY, JSON.stringify(result));
      return Promise.resolve(result);
    }
    return new Promise(function (resolve) {
      storage.api.set(
        {
          [STORAGE_KEY]: result
        },
        function () {
          resolve(result);
        }
      );
    });
  }

  function loadLatestAnalysis() {
    var storage = getStorageArea();
    if (!storage) {
      return Promise.resolve(null);
    }
    if (storage.type === "local") {
      try {
        return Promise.resolve(JSON.parse(storage.api.getItem(STORAGE_KEY) || "null"));
      } catch (error) {
        return Promise.resolve(null);
      }
    }
    return new Promise(function (resolve) {
      storage.api.get(STORAGE_KEY, function (value) {
        resolve(value[STORAGE_KEY] || null);
      });
    });
  }

  function getOptionLabel(list, value) {
    var match = list.find(function (item) {
      return item.value === value;
    });
    return match ? match.label : toTitleCase(value);
  }

  function inferPlatform(url, fileName) {
    var source = [url || "", fileName || ""].join(" ").toLowerCase();
    if (source.indexOf("tiktok") >= 0) {
      return "TikTok";
    }
    if (source.indexOf("instagram") >= 0 || source.indexOf("insta") >= 0) {
      return "Instagram";
    }
    if (source.indexOf("youtube") >= 0 || source.indexOf("youtu.be") >= 0) {
      return "YouTube";
    }
    if (fileName) {
      return "Upload";
    }
    return "Web Video";
  }

  function deriveTitle(url, fileName, platform) {
    if (fileName) {
      return fileName.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ");
    }
    if (url) {
      try {
        var parsed = new URL(url);
        var parts = parsed.pathname.split("/").filter(Boolean);
        var tail = parts.pop() || parts.pop();
        if (tail) {
          return decodeURIComponent(tail).replace(/[-_]+/g, " ");
        }
      } catch (error) {
        return platform + " import";
      }
    }
    return platform + " import";
  }

  function buildMetrics(seed, platform, targetLanguage, learnerLevel, goal, sourceText) {
    var clarity = 58 + (seed % 32);
    var subtitles = 50 + ((seed >> 3) % 38);
    var levelFit = 55 + ((seed >> 5) % 34);
    var pace = 48 + ((seed >> 7) % 40);
    var retention = 54 + ((seed >> 9) % 33);

    if (platform === "YouTube") {
      clarity += 8;
      subtitles += 5;
    }
    if (platform === "TikTok") {
      retention += 9;
      pace -= 4;
    }
    if (platform === "Instagram") {
      retention += 6;
      subtitles -= 3;
    }
    if (platform === "Upload") {
      levelFit += 4;
    }

    if (sourceText.indexOf("caption") >= 0 || sourceText.indexOf("subtitle") >= 0) {
      subtitles += 12;
    }
    if (
      sourceText.indexOf("slow") >= 0 ||
      sourceText.indexOf("beginner") >= 0 ||
      sourceText.indexOf("clear") >= 0
    ) {
      clarity += 7;
      pace += 8;
    }
    if (
      sourceText.indexOf("slang") >= 0 ||
      sourceText.indexOf("fast") >= 0 ||
      sourceText.indexOf("comedy") >= 0
    ) {
      pace -= 10;
      levelFit -= 7;
    }
    if (
      sourceText.indexOf(targetLanguage) >= 0 ||
      sourceText.indexOf(getOptionLabel(languages, targetLanguage).toLowerCase()) >= 0
    ) {
      levelFit += 9;
    }

    if (goal === "pronunciation") {
      clarity += 5;
      pace += 4;
    }
    if (goal === "vocabulary") {
      subtitles += 6;
      retention += 3;
    }
    if (goal === "conversation") {
      pace += 2;
      retention += 4;
    }
    if (goal === "listening") {
      clarity += 4;
      subtitles += 2;
    }

    if (learnerLevel === "a1" || learnerLevel === "a2") {
      pace += 5;
      clarity += 2;
    }
    if (learnerLevel === "c1") {
      retention += 4;
    }

    return {
      clarity: clamp(clarity, 28, 98),
      subtitles: clamp(subtitles, 24, 98),
      levelFit: clamp(levelFit, 20, 99),
      pace: clamp(pace, 15, 96),
      retention: clamp(retention, 30, 99)
    };
  }

  function summarizePerformance(metrics) {
    if (metrics.levelFit >= 85 && metrics.clarity >= 80) {
      return "Excellent fit for guided learning";
    }
    if (metrics.pace < 45 || metrics.subtitles < 45) {
      return "High-energy clip with learning friction";
    }
    if (metrics.retention >= 85) {
      return "Memorable clip with strong replay value";
    }
    return "Solid candidate for mixed practice";
  }

  function buildStrengths(metrics, goal) {
    var strengths = [];

    if (metrics.clarity >= 75) {
      strengths.push("Speech sounds clean enough for repeat listening and shadowing.");
    }
    if (metrics.subtitles >= 72) {
      strengths.push("Caption support is strong enough to anchor comprehension.");
    }
    if (metrics.levelFit >= 78) {
      strengths.push("Vocabulary density matches the selected learner level well.");
    }
    if (metrics.retention >= 78) {
      strengths.push("The format is memorable, which helps phrase retention.");
    }
    if (goal === "conversation" && metrics.pace >= 65) {
      strengths.push("Delivery rhythm feels close to natural conversation speed.");
    }

    if (!strengths.length) {
      strengths.push("The clip still offers useful exposure to authentic language patterns.");
    }

    return strengths.slice(0, 3);
  }

  function buildCautions(metrics, learnerLevel) {
    var cautions = [];

    if (metrics.pace < 50) {
      cautions.push("Speech may feel too fast or too compressed for easy parsing.");
    }
    if (metrics.subtitles < 55) {
      cautions.push("Limited subtitle support could make first-pass comprehension harder.");
    }
    if (metrics.levelFit < 60) {
      cautions.push("Vocabulary may sit above the chosen learner level.");
    }
    if ((learnerLevel === "a1" || learnerLevel === "a2") && metrics.pace < 60) {
      cautions.push("Beginners would likely need pausing or replay support.");
    }

    if (!cautions.length) {
      cautions.push("No major friction flags in the prototype estimate.");
    }

    return cautions.slice(0, 3);
  }

  function buildNextSteps(metrics, goal) {
    var steps = [];

    if (metrics.subtitles < 70) {
      steps.push("Auto-generate bilingual subtitles before presenting the clip in Duolingo.");
    } else {
      steps.push("Convert the subtitle lines into tap-to-translate study cards.");
    }

    if (goal === "pronunciation") {
      steps.push("Offer sentence shadowing with waveform comparison for key phrases.");
    } else if (goal === "conversation") {
      steps.push("Turn high-value lines into roleplay prompts after the learner watches.");
    } else {
      steps.push("Pull the strongest phrases into a spaced-repetition review set.");
    }

    if (metrics.pace < 55) {
      steps.push("Add slow-playback and phrase-by-phrase playback controls in the lesson flow.");
    } else {
      steps.push("Queue a follow-up clip with slightly higher difficulty for progression.");
    }

    return steps;
  }

  function analyzeSubmission(input) {
    var url = input.url || "";
    var fileName = input.fileName || "";
    var targetLanguage = input.targetLanguage || "spanish";
    var learnerLevel = input.learnerLevel || "a2";
    var goal = input.goal || "listening";
    var platform = inferPlatform(url, fileName);
    var title = deriveTitle(url, fileName, platform);
    var sourceText = [url, fileName, title].join(" ").toLowerCase();
    var seed = hashString([url, fileName, targetLanguage, learnerLevel, goal].join("|"));
    var metrics = buildMetrics(seed, platform, targetLanguage, learnerLevel, goal, sourceText);
    var score = Math.round(
      metrics.clarity * 0.26 +
        metrics.subtitles * 0.2 +
        metrics.levelFit * 0.24 +
        metrics.pace * 0.14 +
        metrics.retention * 0.16
    );
    var summary = summarizePerformance(metrics);
    var languageLabel = getOptionLabel(languages, targetLanguage);
    var levelLabel = getOptionLabel(levels, learnerLevel);
    var goalLabel = getOptionLabel(goals, goal);

    return {
      id: "analysis-" + seed,
      title: toTitleCase(title),
      platform: platform,
      targetLanguage: targetLanguage,
      targetLanguageLabel: languageLabel,
      learnerLevel: learnerLevel,
      learnerLevelLabel: levelLabel,
      goal: goal,
      goalLabel: goalLabel,
      score: clamp(score, 0, 100),
      summary: summary,
      metrics: [
        { label: "Speech clarity", value: metrics.clarity },
        { label: "Subtitle support", value: metrics.subtitles },
        { label: "Level fit", value: metrics.levelFit },
        { label: "Pace match", value: metrics.pace },
        { label: "Retention value", value: metrics.retention }
      ],
      strengths: buildStrengths(metrics, goal),
      cautions: buildCautions(metrics, learnerLevel),
      nextSteps: buildNextSteps(metrics, goal),
      meta: [
        platform,
        languageLabel,
        levelLabel,
        goalLabel
      ],
      timestamp: new Date().toISOString()
    };
  }

  function convertDemoToAnalysis(item) {
    var metrics = item.metrics;
    var score = Math.round(
      metrics.clarity * 0.26 +
        metrics.subtitles * 0.2 +
        metrics.levelFit * 0.24 +
        metrics.pace * 0.14 +
        metrics.retention * 0.16
    );

    return {
      id: item.id,
      title: item.title,
      platform: item.platform,
      targetLanguage: item.targetLanguage,
      targetLanguageLabel: getOptionLabel(languages, item.targetLanguage),
      learnerLevel: item.learnerLevel,
      learnerLevelLabel: getOptionLabel(levels, item.learnerLevel),
      goal: item.goal,
      goalLabel: getOptionLabel(goals, item.goal),
      score: score,
      summary: summarizePerformance(metrics),
      metrics: [
        { label: "Speech clarity", value: metrics.clarity },
        { label: "Subtitle support", value: metrics.subtitles },
        { label: "Level fit", value: metrics.levelFit },
        { label: "Pace match", value: metrics.pace },
        { label: "Retention value", value: metrics.retention }
      ],
      strengths: buildStrengths(metrics, item.goal),
      cautions: buildCautions(metrics, item.learnerLevel),
      nextSteps: buildNextSteps(metrics, item.goal),
      meta: [
        item.platform,
        getOptionLabel(languages, item.targetLanguage),
        getOptionLabel(levels, item.learnerLevel),
        item.duration
      ],
      description: item.description,
      tags: item.tags,
      sourceUrl: item.sourceUrl,
      timestamp: new Date().toISOString()
    };
  }

  window.MediaMentorMock = {
    STORAGE_KEY: STORAGE_KEY,
    languages: languages,
    levels: levels,
    goals: goals,
    demoVideos: demoVideos,
    analyzeSubmission: analyzeSubmission,
    convertDemoToAnalysis: convertDemoToAnalysis,
    saveLatestAnalysis: saveLatestAnalysis,
    loadLatestAnalysis: loadLatestAnalysis
  };
})();
