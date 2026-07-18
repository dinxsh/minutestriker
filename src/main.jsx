import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  BadgeDollarSign,
  Check,
  ChevronDown,
  Clock3,
  Coins,
  ExternalLink,
  Flame,
  Gauge,
  Lock,
  ShieldCheck,
  Trophy,
  Wallet,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import {
  fetchFixtures,
  fetchLiveMatchSnapshot,
  fetchTxLineReadiness,
  getTxLineReadiness,
  initialMatchSnapshot,
  resolvePrediction,
  txLineNetworkConfig,
} from "./integrations";
import "./styles.css";

const questions = [
  {
    category: "Discipline",
    text: "Will there be a foul or card before minute {next}?",
    context:
      "TxLINE is showing pressure near midfield with three defensive duels in the last 90 seconds.",
    yes: "Foul confirmed by TxLINE",
    no: "No foul event in minute",
    rule: "YES if free_kick, foul, yellow_card, or red_card appears in target minute",
    match: (event) =>
      ["free_kick", "foul", "yellow_card", "red_card", "card"].some((type) => event.type?.includes(type)),
  },
  {
    category: "Attack",
    text: "Will either team attempt a shot in this minute?",
    context:
      "Both teams are pushing higher, with possession entering the final third twice since the last card.",
    yes: "Shot attempt registered",
    no: "No shot attempt registered",
    rule: "YES if any shot event appears in target minute",
    match: (event) => event.type?.includes("shot"),
  },
  {
    category: "Set Piece",
    text: "Will the ball go out for a corner or free kick?",
    context:
      "Wide overload detected on the right flank; crossing probability is rising.",
    yes: "Set piece awarded",
    no: "Open play continued",
    rule: "YES if corner or non-offside free_kick appears in target minute",
    match: (event) =>
      event.type?.includes("corner") ||
      (event.type?.includes("free_kick") && event.data?.FreeKickType !== "Offside"),
  },
  {
    category: "Possession",
    text: "Will {home} retain more possession than {away} this minute?",
    context:
      "Short-pass tempo has increased while the live feed reports the current possession split.",
    yes: "{home} possession edge",
    no: "{away} possession edge",
    rule: "YES if home possession is greater than or equal to 50 at settlement",
    statOnly: true,
    match: (_event, snapshot) => snapshot.homePossession >= 50,
  },
];

const initialFeed = [];
const txLineSetupLinks = [
  {
    label: "World Cup free tier",
    href: "https://txline.txodds.com/documentation/worldcup",
  },
  {
    label: "Quickstart",
    href: "https://txline.txodds.com/documentation/quickstart",
  },
  {
    label: "Devnet examples",
    href: "https://txline.txodds.com/documentation/examples/devnet-examples",
  },
];

const formatMoney = (value) => (Number.isFinite(value) ? value : 0).toFixed(2);
const formatWallet = (address) => (address ? `${address.slice(0, 4)}...${address.slice(-4)}` : "");
const formatFeedTime = (feedMinute, currentSecond) =>
  `${feedMinute}:${String(Math.min(60, Math.max(0, currentSecond))).padStart(2, "0")}`;

function App() {
  const [second, setSecond] = useState(0);
  const [minute, setMinute] = useState(initialMatchSnapshot.minute);
  const [stake, setStake] = useState(1);
  const [balance, setBalance] = useState(42.5);
  const [wallet, setWallet] = useState(null);
  const [match, setMatch] = useState(initialMatchSnapshot);
  const [fixtures, setFixtures] = useState([]);
  const [fixturesLoading, setFixturesLoading] = useState(true);
  const [fixturesError, setFixturesError] = useState("");
  const [selectedFixtureId, setSelectedFixtureId] = useState(initialMatchSnapshot.fixtureId);
  const [liveError, setLiveError] = useState("");
  const [lastPoll, setLastPoll] = useState({
    tone: "idle",
    label: "Waiting",
    detail: "No feed poll yet",
  });
  const [readiness, setReadiness] = useState(getTxLineReadiness());
  const [pick, setPick] = useState(null);
  const [lockedWager, setLockedWager] = useState(null);
  const [locked, setLocked] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [pool, setPool] = useState(218.4);
  const [toast, setToast] = useState("");
  const [feed, setFeed] = useState(initialFeed);
  const [settlement, setSettlement] = useState({
    tone: "idle",
    icon: "?",
    title: "Awaiting lock",
    body: "Pick YES or NO before the 30 second lock.",
    payout: "--",
    receipt: null,
  });
  const [stats, setStats] = useState({
    attacks: initialMatchSnapshot.attacks,
    duels: initialMatchSnapshot.duels,
    corners: initialMatchSnapshot.corners,
    cards: initialMatchSnapshot.cards,
    homePossession: initialMatchSnapshot.homePossession,
    awayShots: initialMatchSnapshot.awayShots,
  });
  const matchRef = useRef(initialMatchSnapshot);
  const minuteRef = useRef(initialMatchSnapshot.minute);

  const question = questions[questionIndex % questions.length];
  const inActionWindow = second < 30;
  const remaining = inActionWindow ? 30 - second : 60 - second;
  const progress = Math.min(100, (second / 60) * 100);
  const marketReady = Boolean(readiness.configured && selectedFixtureId && match.connected);
  const setupBlocked = !marketReady;
  const renderedQuestionText = question.text
    .replace("{next}", minute + 1)
    .replace("{home}", match.homeName)
    .replace("{away}", match.awayName);
  const renderCopy = (value) =>
    String(value).replace("{home}", match.homeName).replace("{away}", match.awayName);

  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(""), 1800);
  };

  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  useEffect(() => {
    minuteRef.current = minute;
  }, [minute]);

  const addFeed = (label, currentSecond = second, feedMinute = minuteRef.current) => {
    setFeed((items) => [
      ...items.slice(-7),
      { minute: formatFeedTime(feedMinute, currentSecond), label },
    ]);
  };

  const connectWallet = async () => {
    const provider = window.solana;

    if (!provider?.connect) {
      showToast("Install Phantom or a Solana wallet");
      return;
    }

    try {
      const response = await provider.connect();
      setWallet(response.publicKey.toString());
      showToast("Wallet connected");
    } catch {
      showToast("Wallet connection cancelled");
    }
  };

  const placePick = (nextPick) => {
    if (locked || !inActionWindow) return;

    if (!marketReady) {
      showToast("TxLINE live market is not ready");
      return;
    }

    if (!Number.isFinite(stake) || stake <= 0) {
      showToast("Enter a stake above 0 USDC");
      return;
    }

    if (balance < stake) {
      showToast("Stake exceeds available balance");
      return;
    }

    setPick(nextPick);
    setLockedWager({
      pick: nextPick,
      question,
      stake,
      targetMinute: minuteRef.current,
      fixtureId: matchRef.current.fixtureId,
      sequence: matchRef.current.sequence || "n/a",
    });
    setLocked(true);
    setBalance((value) => value - stake);
    setPool((value) => value + stake);
    setSettlement({
      tone: nextPick === "YES" ? "yes" : "no",
      icon: nextPick === "YES" ? "Y" : "N",
      title: `${nextPick} locked`,
      body: `${formatMoney(stake)} USDC committed for minute ${minute}.`,
      payout: "Live",
    });
    showToast(`${nextPick} locked for ${formatMoney(stake)} USDC`);
  };

  const settleMinute = () => {
    const wager = lockedWager ?? {
      pick: null,
      question,
      stake,
      targetMinute: minuteRef.current,
    };
    const resolution = resolvePrediction({
      question: wager.question,
      pick: wager.pick,
      stake: wager.stake,
      snapshot: matchRef.current,
      targetMinute: wager.targetMinute,
    });
    resolution.receipt.lockedFixtureId = wager.fixtureId || resolution.receipt.fixtureId;
    resolution.receipt.lockedSequence = wager.sequence || resolution.receipt.sequence;
    const won = resolution.won;
    const payout = resolution.payout;

    if (won) setBalance((value) => value + payout);

    setSettlement(
      wager.pick
        ? {
            tone: won ? "won" : "lost",
            icon: won ? "+" : "-",
            title: won ? "Prediction won" : "Prediction missed",
            body: renderCopy(resolution.answer === "YES" ? wager.question.yes : wager.question.no),
            payout: won ? `+${formatMoney(payout)} USDC` : `-${formatMoney(wager.stake)}`,
            receipt: resolution.receipt,
          }
        : {
            tone: "idle",
            icon: "-",
            title: "Minute skipped",
            body: "No prediction was locked before the action window closed.",
            payout: "--",
            receipt: resolution.receipt,
          },
    );
    addFeed(resolution.answer === "YES" ? wager.question.yes : wager.question.no, 60, wager.targetMinute);
    showToast(won ? "Settlement paid instantly" : "Minute settled");
  };

  const advanceMinute = () => {
    setSecond(0);
    setQuestionIndex((value) => value + 1);
    setPick(null);
    setLockedWager(null);
    setLocked(false);
    setPool(180 + Math.random() * 95);
    setSettlement({
      tone: "idle",
      icon: "?",
      title: "Awaiting lock",
      body: "Pick YES or NO before the 30 second lock.",
      payout: "--",
      receipt: null,
    });
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecond((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;

    fetchTxLineReadiness().then((nextReadiness) => {
      if (alive) setReadiness(nextReadiness);
    });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    fetchFixtures().then((nextFixtures) => {
      if (!alive) return;
      setFixtures(nextFixtures);
      setFixturesLoading(false);
      setFixturesError("");
      setLastPoll({
        tone: "ok",
        label: "Fixtures live",
        detail: nextFixtures.length ? `${nextFixtures.length} fixture option loaded` : "No fixture rows returned",
      });
      if (!selectedFixtureId && nextFixtures[0]?.fixtureId) {
        setSelectedFixtureId(nextFixtures[0].fixtureId);
      }
    }).catch((error) => {
      if (!alive) return;
      setFixturesLoading(false);
      setFixturesError(error.message);
      setLastPoll({
        tone: "error",
        label: "Fixture error",
        detail: error.message,
      });
      setFixtures([]);
    });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const poll = async () => {
      try {
        const snapshot = await fetchLiveMatchSnapshot({
          fixtureId: selectedFixtureId,
          previous: matchRef.current,
        });
        if (!alive) return;

        setLiveError("");
        setLastPoll({
          tone: snapshot.connected ? "ok" : "error",
          label: snapshot.connected ? "TxLINE live" : "Snapshot unavailable",
          detail: `${snapshot.source} at minute ${snapshot.minute ?? "n/a"}`,
        });
        matchRef.current = snapshot;
        setMatch(snapshot);
        setStats({
          attacks: snapshot.attacks,
          duels: snapshot.duels,
          corners: snapshot.corners,
          cards: snapshot.cards,
          homePossession: snapshot.homePossession,
          awayShots: snapshot.awayShots,
        });

        if (snapshot.connected && snapshot.minute) {
          setMinute(snapshot.minute);
        }

        if (snapshot.latestEvent) {
          addFeed(snapshot.latestEvent);
        }
      } catch (error) {
        if (!alive) return;
        setLiveError(error.message);
        setLastPoll({
          tone: "error",
          label: "Snapshot error",
          detail: error.message,
        });
        setMatch((value) => {
          const nextMatch = { ...value, connected: false, source: "Feed Error" };
          matchRef.current = nextMatch;
          return nextMatch;
        });
      }
    };

    poll();
    const interval = window.setInterval(poll, 5000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [selectedFixtureId]);

  useEffect(() => {
    if (second === 30 && !locked) {
      setSettlement({
        tone: "idle",
        icon: <Lock size={18} />,
        title: "Action window closed",
        body: "The pool is frozen until this minute resolves.",
        payout: "Locked",
        receipt: null,
      });
    }

    if (second === 60) {
      settleMinute();
      const next = window.setTimeout(advanceMinute, 1500);
      return () => window.clearTimeout(next);
    }
  }, [second]);

  const controlsDisabled = locked || !inActionWindow || !marketReady;
  const phaseCopy = marketReady ? (inActionWindow ? "Action window open" : "Sweat window locked") : "TxLINE unavailable";
  const statusCards = useMemo(
    () => [
      {
        icon: <Clock3 size={18} />,
        label: "Market Open",
        value: "00s-30s",
        body: "One-minute binary market with explicit stake lock.",
      },
      {
        icon: <Gauge size={18} />,
        label: "Market Frozen",
        value: "30s-60s",
        body: "Pool freezes while TxLINE telemetry keeps updating.",
      },
      {
        icon: <ShieldCheck size={18} />,
        label: "Settlement",
        value: "Instant",
        body: "Rule-based receipt resolves from score events and proof routes.",
      },
    ],
    [],
  );

  return (
    <main className="app-shell">
      <section className="phone-frame" aria-label="mineetes mobile app">
        <div className="phone-screen">
          <header className="match-hero">
            <nav className="topbar" aria-label="Match controls">
              <div className="brand">
                <span className="logo-mark" aria-hidden="true">
                  <span className="logo-mi">mi</span>
                  <span className="logo-bolt" />
                </span>
                <span>mineetes</span>
              </div>
              <div className={match.connected ? "live-pill" : "live-pill offline"}>
                {match.connected ? <Wifi size={14} /> : <WifiOff size={14} />}
                {match.source}
              </div>
            </nav>

            {marketReady ? (
              <>
                <div className="scoreline">
                  <Team name={match.homeName} sublabel="Possession" stat={`${stats.homePossession}%`} />
                  <div className="score">
                    {match.homeScore}-{match.awayScore}
                  </div>
                  <Team name={match.awayName} sublabel="Shots" stat={stats.awayShots} align="right" />
                </div>

                <div className="ticker">
                  <div className="minute">
                    <strong>{minute}'</strong>
                    <span>{phaseCopy}</span>
                  </div>
                  <div className="balance-card">
                    <span>{wallet ? "Wallet" : "Balance"}</span>
                    <strong>
                      {wallet ? formatWallet(wallet) : `${formatMoney(balance)} USDC`}
                    </strong>
                  </div>
                </div>
              </>
            ) : (
              <div className="txline-gate">
                <span>Production data required</span>
                <strong>Connect TxLINE before markets open</strong>
                <p>No fixture, scoreline, timer market, or balance is shown until a real TxLINE snapshot succeeds.</p>
              </div>
            )}
          </header>

          <section className="play-stack">
            <section className="session-strip" aria-label="Session setup">
              <button className="wallet-button" onClick={connectWallet} type="button">
                <Wallet size={17} />
                {wallet ? "Wallet connected" : "Connect wallet"}
              </button>

              <label className="fixture-picker">
                <span>{fixturesLoading ? "Loading matches" : "TxLINE fixture"}</span>
                <select
                  aria-label="Select match fixture"
                  disabled={fixturesLoading || fixtures.length === 0}
                  onChange={(event) => {
                    setSelectedFixtureId(event.target.value);
                    setSecond(0);
                  }}
                  value={selectedFixtureId}
                >
                  {fixtures.map((fixture) => (
                    <option key={fixture.fixtureId} value={fixture.fixtureId}>
                      {fixture.label} - {fixture.status}
                    </option>
                  ))}
                </select>
              </label>
              <p className="session-note">
                {readiness.configured
                  ? `${readiness.network} feed credentials present at service level ${readiness.serviceLevel}.`
                  : `Missing ${readiness.missing.join(" and ")}; live markets remain closed.`}
              </p>
              <p className="session-note secondary">
                {wallet
                  ? "Connected wallet is used for identity; treasury custody must be configured before accepting real funds."
                  : "Get credentials from TxLINE: subscribe with your Solana wallet, request guest JWT, sign txSig::jwt, then activate the API token."}
              </p>
              {!readiness.configured ? (
                <div className="setup-guide" aria-label="Where to get TxLINE credentials">
                  <div>
                    <strong>Where to get JWT + token</strong>
                    <span>World Cup free tier: service level 1 delayed or 12 real-time. Needs SOL for subscription fees.</span>
                  </div>
                  {txLineSetupLinks.map((link) => (
                    <a href={link.href} key={link.href} rel="noreferrer" target="_blank">
                      {link.label}
                      <ExternalLink size={13} />
                    </a>
                  ))}
                </div>
              ) : null}
              <div className="readiness-panel" aria-label="TxLINE readiness">
                <StatusChip label="Network" value={readiness.network} tone="ok" />
                <StatusChip label="Level" value={readiness.serviceLevel} tone="ok" />
                <StatusChip label="JWT" value={readiness.hasGuestJwt ? "Present" : "Missing"} tone={readiness.hasGuestJwt ? "ok" : "warn"} />
                <StatusChip label="Token" value={readiness.hasApiToken ? "Present" : "Missing"} tone={readiness.hasApiToken ? "ok" : "warn"} />
                <StatusChip label="Fixture" value={selectedFixtureId ? "Selected" : "Missing"} tone={selectedFixtureId ? "ok" : "warn"} />
                <StatusChip label="Last Poll" value={lastPoll.label} tone={lastPoll.tone} />
              </div>
              {fixturesError || liveError ? (
                <p className="state-note" role="status">
                  {fixturesError || liveError}. Configure TxLINE before opening markets.
                </p>
              ) : null}
              {!fixturesLoading && fixtures.length === 0 ? (
                <p className="state-note" role="status">
                  No TxLINE fixtures returned. Markets stay closed until a live fixture is available.
                </p>
              ) : null}
            </section>

            {setupBlocked ? <ProductionGateCard readiness={readiness} /> : (
            <article className={`cycle-card ${inActionWindow ? "is-action" : "is-sweat"}`}>
              <div className="phase-row">
                <span>{inActionWindow ? "00s-30s prediction" : "30s-60s sweat"}</span>
                <strong>{Math.max(0, remaining)}s</strong>
              </div>

              <div className="timer-block">
                <div className="timer-label">
                  <span>Minute cycle</span>
                  <b>Pool {formatMoney(pool)} USDC</b>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${progress}%` }} />
                </div>
              </div>

              <div className="question-block">
                <span className="category">{question.category}</span>
                <h1>{renderedQuestionText}</h1>
                <p>{question.context}</p>
              </div>

              <div className="stake-block">
                <div className="stake-label">
                  <span>Stake</span>
                  <strong>{formatMoney(stake)} USDC</strong>
                </div>
                <label className="stake-input-wrap">
                  <Coins size={16} />
                  <input
                    disabled={controlsDisabled}
                    inputMode="decimal"
                    min="0.01"
                    onChange={(event) => {
                      const nextStake = Number(event.target.value);
                      setStake(Number.isFinite(nextStake) ? nextStake : 0);
                    }}
                    placeholder="Type any amount"
                    step="0.01"
                    type="number"
                    value={stake || ""}
                  />
                  <span>USDC</span>
                </label>
                <div className="chip-grid">
                  {[1, 2.5, 5, 10].map((amount) => (
                    <button
                      className={stake === amount ? "chip active" : "chip"}
                      disabled={controlsDisabled}
                      key={amount}
                      onClick={() => setStake(amount)}
                      type="button"
                    >
                      <Coins size={15} />
                      {amount}
                    </button>
                  ))}
                </div>
              </div>

              <div className="decision-row">
                <button
                  className="decision yes"
                  disabled={controlsDisabled}
                  onClick={() => placePick("YES")}
                  type="button"
                >
                  <Check size={22} />
                  YES
                </button>
                <button
                  className="decision no"
                  disabled={controlsDisabled}
                  onClick={() => placePick("NO")}
                  type="button"
                >
                  <X size={22} />
                  NO
                </button>
              </div>
            </article>
            )}

            <SettlementCard settlement={settlement} />
            <FeedCard feed={feed} />
          </section>
        </div>
      </section>

      <aside className="desktop-panel">
        <section className="intro-panel">
          <div className="eyebrow">
            <Flame size={16} />
            World Cup live companion
          </div>
          <h2>Prediction markets that settle every minute.</h2>
          <p>
            mineetes transforms every match minute into a rapid-fire predictive arcade
            loop built around TxLINE match events, settlement receipts, and score validation.
          </p>
        </section>

        <section className="status-grid">
          {statusCards.map((card) => (
            <article className="status-card" key={card.label}>
              <span className="status-icon">{card.icon}</span>
              <small>{card.label}</small>
              <strong>{card.value}</strong>
              <p>{card.body}</p>
            </article>
          ))}
        </section>

        <section className="metrics-panel">
          <header>
            <h2>Minute Telemetry</h2>
            <div className="oracle-chip">
              <Activity size={15} />
              {liveError || match.source}
            </div>
          </header>
          <div className="metrics-grid">
            <Metric label="Attacks" value={stats.attacks} />
            <Metric label="Duels" value={stats.duels} />
            <Metric label="Corners" value={stats.corners} />
            <Metric label="Cards" value={stats.cards} />
          </div>
        </section>

        <section className="architecture-panel">
          <h2>Prediction Markets Track</h2>
          <div className="rail-item">
            <BadgeDollarSign size={18} />
            <span>Binary micro-markets with stake lock and payout ledger</span>
          </div>
          <div className="rail-item">
            <Zap size={18} />
            <span>
              TxLINE {txLineNetworkConfig.network} service level {txLineNetworkConfig.serviceLevel} data backend
            </span>
          </div>
          <div className="rail-item">
            <Trophy size={18} />
            <span>Score validation proxy for on-chain proof integration</span>
          </div>
        </section>
      </aside>

      <div className={toast ? "toast show" : "toast"}>{toast}</div>
    </main>
  );
}

function Team({ name, sublabel, stat, align = "left" }) {
  return (
    <div className={`team ${align === "right" ? "right" : ""}`}>
      <strong>{name}</strong>
      <span>
        {sublabel} <b>{stat}</b>
      </span>
    </div>
  );
}

function ProductionGateCard({ readiness }) {
  return (
    <article className="production-gate-card">
      <div className="phase-row">
        <span>Markets closed</span>
        <strong>Live only</strong>
      </div>
      <div className="production-gate-body">
        <ShieldCheck size={24} />
        <div>
          <h1>Live TxLINE only</h1>
          <p>
            mineetes opens the prediction card only after TxLINE credentials are configured,
            fixtures load, and a live score snapshot poll succeeds.
          </p>
        </div>
      </div>
      <div className="env-list">
        <code>TXLINE_JWT</code>
        <code>TXLINE_API_TOKEN</code>
        <code>TXLINE_SERVICE_LEVEL={readiness.serviceLevel}</code>
      </div>
    </article>
  );
}

function SettlementCard({ settlement }) {
  return (
    <article className="settlement-card">
      <h2>Instant Settlement</h2>
      <div className="result">
        <span className={`result-icon ${settlement.tone}`}>{settlement.icon}</span>
        <div>
          <strong>{settlement.title}</strong>
          <p>{settlement.body}</p>
        </div>
        <b>{settlement.payout}</b>
      </div>
      {settlement.receipt ? (
        <details className="receipt-proof">
          <summary>
            <ShieldCheck size={16} />
            <span>
              {settlement.receipt.answer} by rule - minute {settlement.receipt.targetMinute}'
            </span>
            <ChevronDown size={16} />
          </summary>
          <div className="receipt-grid" aria-label="Settlement receipt">
            <div>
              <span>Answer</span>
              <strong>{settlement.receipt.answer}</strong>
            </div>
            <div>
              <span>Seq</span>
              <strong>{settlement.receipt.sequence}</strong>
            </div>
            <div>
              <span>Locked Seq</span>
              <strong>{settlement.receipt.lockedSequence}</strong>
            </div>
            <div>
              <span>Events</span>
              <strong>{settlement.receipt.eventCount}</strong>
            </div>
            <div>
              <span>Source</span>
              <strong>{settlement.receipt.source}</strong>
            </div>
            <div>
              <span>Fixture</span>
              <strong>{settlement.receipt.fixtureId}</strong>
            </div>
            <div>
              <span>Locked Fixture</span>
              <strong>{settlement.receipt.lockedFixtureId}</strong>
            </div>
            <div className="receipt-rule">
              <span>Rule</span>
              <strong>{settlement.receipt.rule}</strong>
            </div>
          </div>
        </details>
      ) : null}
    </article>
  );
}

function FeedCard({ feed }) {
  return (
    <article className="feed-card">
      <h2>Live Match Feed</h2>
      <div className="feed-list">
        {feed.length === 0 ? (
          <div className="feed-item empty">
            <strong>--:--</strong>
            <span>Waiting for TxLINE events</span>
          </div>
        ) : (
          feed
          .slice(-5)
          .reverse()
          .map((item, index) => (
            <div className="feed-item" key={`${item.minute}-${item.label}-${index}`}>
              <strong>{item.minute}</strong>
              <span>{item.label}</span>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusChip({ label, value, tone }) {
  return (
    <div className={`status-chip ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
