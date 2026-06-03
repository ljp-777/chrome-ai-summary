let stopGame = null;
let currentGameId = "bubble";

const GAMES = {
  bubble: { label: "气泡", tip: "点击上升的气泡" },
  whack: { label: "地鼠", tip: "快速点击亮起的格子" },
  catch: { label: "接物", tip: "点击下落的星星" },
  click: { label: "速点", tip: "疯狂点击靶心" }
};

function startLoadingGame(root) {
  stopLoadingGame();
  let score = 0;
  let alive = true;
  let innerStop = null;

  root.innerHTML = `
    <div class="ai-load-wrap">
      <div class="ai-load-top">
        <span class="ai-load-status">正在总结</span>
        <span class="ai-load-dots"><i></i><i></i><i></i></span>
        <div class="ai-load-tabs"></div>
        <span class="ai-load-score">得分 <b>0</b></span>
      </div>
      <div class="ai-load-game"></div>
      <div class="ai-load-tip"></div>
    </div>
  `;

  const tabs = root.querySelector(".ai-load-tabs");
  const gameEl = root.querySelector(".ai-load-game");
  const scoreEl = root.querySelector(".ai-load-score b");
  const tipEl = root.querySelector(".ai-load-tip");

  Object.entries(GAMES).forEach(([id, { label }]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ai-load-tab" + (id === currentGameId ? " active" : "");
    btn.textContent = label;
    btn.addEventListener("click", () => {
      if (id === currentGameId) return;
      currentGameId = id;
      tabs.querySelectorAll(".ai-load-tab").forEach((t) => t.classList.remove("active"));
      btn.classList.add("active");
      launch();
    });
    tabs.appendChild(btn);
  });

  function addScore(n = 1) {
    score += n;
    scoreEl.textContent = score;
  }

  function launch() {
    innerStop?.();
    innerStop = null;
    gameEl.innerHTML = "";
    gameEl.className = "ai-load-game";
    tipEl.textContent = GAMES[currentGameId].tip;
    if (!alive) return;
    innerStop = GAME_START[currentGameId](gameEl, addScore, () => alive);
  }

  launch();

  stopGame = () => {
    alive = false;
    innerStop?.();
    root.innerHTML = "";
    stopGame = null;
  };
}

const GAME_START = {
  bubble(game, addScore, isAlive) {
    function spawn() {
      if (!isAlive()) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ai-load-bubble";
      b.style.left = `${8 + Math.random() * 84}%`;
      b.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
      const size = 28 + Math.random() * 14;
      b.style.width = b.style.height = `${size}px`;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        if (b.classList.contains("pop")) return;
        b.classList.add("pop");
        addScore();
      });
      b.addEventListener("animationend", () => b.remove());
      game.appendChild(b);
      if (game.children.length > 12) game.firstChild?.remove();
    }
    spawn();
    const timer = setInterval(spawn, 550);
    return () => clearInterval(timer);
  },

  whack(game, addScore, isAlive) {
    game.className = "ai-load-game ai-load-whack";
    const grid = document.createElement("div");
    grid.className = "ai-load-grid";
    const cells = [];
    for (let i = 0; i < 9; i++) {
      const c = document.createElement("button");
      c.type = "button";
      c.className = "ai-load-hole";
      c.innerHTML = '<span class="mole">🐹</span>';
      c.addEventListener("click", () => {
        if (c.classList.contains("up")) {
          c.classList.remove("up");
          addScore();
        }
      });
      grid.appendChild(c);
      cells.push(c);
    }
    game.appendChild(grid);
    let active = -1;
    const timer = setInterval(() => {
      if (!isAlive()) return;
      if (active >= 0) cells[active].classList.remove("up");
      active = Math.floor(Math.random() * 9);
      cells[active].classList.add("up");
      setTimeout(() => cells[active]?.classList.remove("up"), 700);
    }, 850);
    return () => clearInterval(timer);
  },

  catch(game, addScore, isAlive) {
    game.className = "ai-load-game ai-load-catch";
    function spawn() {
      if (!isAlive()) return;
      const s = document.createElement("button");
      s.type = "button";
      s.className = "ai-load-star";
      s.textContent = "⭐";
      s.style.left = `${5 + Math.random() * 88}%`;
      s.style.animationDuration = `${1.6 + Math.random() * 1.2}s`;
      s.addEventListener("click", (e) => {
        e.stopPropagation();
        if (s.classList.contains("got")) return;
        s.classList.add("got");
        addScore();
        setTimeout(() => s.remove(), 150);
      });
      s.addEventListener("animationend", () => s.remove());
      game.appendChild(s);
      if (game.children.length > 10) game.firstChild?.remove();
    }
    spawn();
    const timer = setInterval(spawn, 650);
    return () => clearInterval(timer);
  },

  click(game, addScore, isAlive) {
    game.className = "ai-load-game ai-load-clicker";
    const target = document.createElement("button");
    target.type = "button";
    target.className = "ai-load-target";
    target.textContent = "点我";
    target.addEventListener("click", (e) => {
      e.stopPropagation();
      addScore();
      target.classList.remove("pulse");
      void target.offsetWidth;
      target.classList.add("pulse");
    });
    game.appendChild(target);
    return () => {};
  }
};

function stopLoadingGame() {
  stopGame?.();
}
