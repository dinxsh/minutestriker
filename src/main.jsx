import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BadgeDollarSign,
  Check,
  ChevronDown,
  Clock3,
  Coins,
  Flame,
  Gauge,
  Lock,
  Medal,
  Palette,
  Settings,
  ShieldCheck,
  Trophy,
  UserCircle,
  UserPlus,
  Wallet,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import {
  createBentoWalletLink,
  estimateBentoBet,
  exchangeBentoWalletCode,
  extractEstimate,
  fetchBentoMarkets,
  fetchBentoPortfolio,
  fetchBentoReadiness,
  fetchLeaderboardUsers,
  humanToWei,
  initialBentoReadiness,
  loginBentoWallet,
  normalizeExternalLogin,
  normalizeBentoLogin,
  placeBentoBet,
  saveLeaderboardUser,
  shortAddress,
  weiToHuman,
} from "./bento";
import "./styles.css";

const formatMoney = (value) => (Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "0.00");
const DEFAULT_PROFILES = [
  { id: "captain-aya", name: "Captain Aya", team: "Argentina", style: "Striker", wins: 18, losses: 4, points: 2840, streak: 9 },
  { id: "press-master", name: "Press Master", team: "France", style: "Midfield", wins: 15, losses: 5, points: 2410, streak: 6 },
  { id: "last-minute", name: "Last Minute", team: "Brazil", style: "Chaos", wins: 13, losses: 6, points: 2195, streak: 5 },
  { id: "clean-sheet", name: "Clean Sheet", team: "Japan", style: "Defense", wins: 11, losses: 7, points: 1880, streak: 4 },
];
const PROFILE_STORAGE_KEY = "haramball-world-cup-profiles";
const ACTIVE_PROFILE_STORAGE_KEY = "haramball-active-profile-id";
const THEME_STORAGE_KEY = "haramball-theme";

function App() {
  const [readiness, setReadiness] = useState(initialBentoReadiness);
  const [markets, setMarkets] = useState([]);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [marketError, setMarketError] = useState("");
  const [marketIndex, setMarketIndex] = useState(0);
  const [wallet, setWallet] = useState("");
  const [token, setToken] = useState("");
  const [authMode, setAuthMode] = useState("");
  const [managedAccount, setManagedAccount] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [walletOptions, setWalletOptions] = useState([]);
  const [stake, setStake] = useState("1");
  const [pick, setPick] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [portfolio, setPortfolio] = useState(null);
  const [profiles, setProfiles] = useState(loadProfiles);
  const [activeProfileId, setActiveProfileId] = useState(() => localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) || "");
  const [profileDraft, setProfileDraft] = useState({ name: "", team: "USA", style: "Striker" });
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(() => !localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY));
  const [profileMode, setProfileMode] = useState("onboarding");
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) || "classic");
  const [toast, setToast] = useState("");
  const [feed, setFeed] = useState([]);
  const [settlement, setSettlement] = useState({
    tone: "idle",
    icon: "?",
    title: "Choose a World Cup market",
    body: "Pick a side, preview your ticket, then lock it before kickoff energy moves on.",
    payout: "--",
    receipt: null,
  });
  const reconcileTimer = useRef(null);

  const market = markets[marketIndex] || null;
  const amountWei = useMemo(() => humanToWei(stake), [stake]);
  const ready = readiness.configured && markets.length > 0;
  const authed = Boolean(token && authMode === "wallet");
  const optionLabel = pick === 0 ? market?.optionA : pick === 1 ? market?.optionB : "";
  const marketTitle = marketsLoading
    ? "Loading World Cup markets..."
    : market?.title || (readiness.configured ? "No match markets returned" : "Market board needs setup");
  const marketBody = market
    ? "Preview your ticket before locking it. Your account refreshes after the pick is accepted."
    : readiness.configured
      ? "Try again when the live market board is available."
      : "Add the server market key, then restart the app to load live World Cup markets.";
  const leaderboard = useMemo(
    () => [...profiles].sort((a, b) => b.wins - a.wins || b.points - a.points).slice(0, 8),
    [profiles],
  );
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId);
  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(""), 1800);
  };

  useEffect(() => {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    let alive = true;
    fetchLeaderboardUsers()
      .then((users) => {
        if (alive && users.length) setProfiles(users.map(normalizeProfile));
      })
      .catch(() => {
        if (alive) showToast("Using local leaderboard cache");
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    let alive = true;
    discoverEvmWalletOptions().then((options) => {
      if (alive) setWalletOptions(options);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchBentoReadiness().then((next) => {
      if (alive) setReadiness(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!readiness.configured) {
      setMarkets([]);
      setMarketError("");
      setMarketsLoading(false);
      return () => {
        alive = false;
      };
    }

    setMarketsLoading(true);
    fetchBentoMarkets({ page: 1, limit: 20 })
      .then((nextMarkets) => {
        if (!alive) return;
        setMarkets(nextMarkets.filter((item) => item.duelId));
        setMarketError("");
      })
      .catch((error) => {
        if (!alive) return;
        setMarketError(error.message);
        setMarkets([]);
      })
      .finally(() => {
        if (alive) setMarketsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [readiness.configured]);

  useEffect(() => {
    setPick(null);
    setEstimate(null);
    setSettlement({
      tone: "idle",
      icon: "?",
      title: market ? "Ready for your pick" : "Choose a World Cup market",
      body: market ? "Select an outcome to preview the ticket before you lock it." : "Live match markets will appear here when the board loads.",
      payout: "--",
      receipt: null,
    });
  }, [market?.duelId]);

  useEffect(() => {
    if (!token) return;
    refreshPortfolio();
    return () => window.clearTimeout(reconcileTimer.current);
  }, [token]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (!code) return;

    setLinkLoading(true);
    exchangeBentoWalletCode({ code })
      .then((payload) => {
        const login = normalizeExternalLogin(payload);
        if (!login.token) throw new Error("Wallet link did not return a session");
        setAuthMode("link");
        setWallet(login.address || "");
        setManagedAccount(login.managedAccount || "");
        setFeed((items) => [{ minute: "now", label: "Wallet linked. Browser wallet still required for tickets." }, ...items].slice(0, 6));
        showToast("Wallet linked for profile");
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      })
      .catch((error) => showToast(error.message))
      .finally(() => setLinkLoading(false));
  }, []);

  const connectWallet = async (walletOption) => {
    const ethereum = walletOption?.provider || window.ethereum;
    if (!ethereum?.request) {
      showToast("No browser wallet found. Use wallet link.");
      return;
    }

    setWalletLoading(true);
    try {
      const [address] = await ethereum.request({ method: "eth_requestAccounts" });
      const timestamp = String(Date.now());
      const message = `Bento.fun Login\nTimestamp: ${timestamp}\nWallet: ${address}`;
      const signature = await ethereum.request({
        method: "personal_sign",
        params: [message, address],
      });
      const login = normalizeBentoLogin(
        await loginBentoWallet({
          address,
          signature,
          timestamp,
          username: activeProfile?.name || `haramball-${address.slice(2, 8)}`,
        }),
      );

      if (!login.token) throw new Error("Market login did not return a session");
      setWallet(address);
      setToken(login.token);
      setAuthMode("wallet");
      setManagedAccount(login.managedAccount || "");
      setFeed((items) => [{ minute: "now", label: `${walletOption?.name || "Wallet"} connected for matchday markets` }, ...items].slice(0, 6));
      showToast(`${walletOption?.name || "Wallet"} connected`);
    } catch (error) {
      showToast(walletErrorMessage(error));
    } finally {
      setWalletLoading(false);
    }
  };

  const connectWithWalletLink = async () => {
    setLinkLoading(true);
    try {
      const returnUrl = `${window.location.origin}${window.location.pathname}`;
      const state = activeProfile?.id || `haramball-${Date.now()}`;
      const payload = await createBentoWalletLink({ returnUrl, state });
      const url = payload.url || payload.data?.url;
      if (!url) throw new Error("Wallet link did not return a URL");
      window.location.href = url;
    } catch (error) {
      showToast(error.message);
    } finally {
      setLinkLoading(false);
    }
  };

  const quotePick = async (optionIndex) => {
    if (!market) return;
    setPick(optionIndex);
    setEstimate(null);

    if (!authed) {
      openProfileModal(activeProfile ? "settings" : "onboarding");
      showToast(authMode === "link" ? "Use browser wallet to trade" : "Connect wallet before previewing");
      return;
    }
    if (Number(stake) <= 0) {
      showToast("Enter a stake above 0");
      return;
    }

    setEstimateLoading(true);
    try {
      const nextEstimate = extractEstimate(
        await estimateBentoBet({
          token,
          duelId: market.duelId,
          optionIndex,
          amountWei,
          slippageBps: 100,
        }),
      );
      setEstimate(nextEstimate);
      setSettlement({
        tone: optionIndex === 0 ? "yes" : "no",
        icon: optionIndex === 0 ? "Y" : "N",
        title: `${optionIndex === 0 ? market.optionA : market.optionB} preview ready`,
        body: nextEstimate.sharesOut
          ? `Estimated ${weiToHuman(nextEstimate.sharesOut)} shares before final confirmation.`
          : "Ticket preview is ready. Review and lock when you are happy.",
        payout: "Preview",
        receipt: null,
      });
    } catch (error) {
      showToast(error.message);
    } finally {
      setEstimateLoading(false);
    }
  };

  const submitBet = async () => {
    if (!market || pick === null || !estimate) {
      showToast("Preview an outcome first");
      return;
    }

    setPlacing(true);
    const idempotencyKey = crypto.randomUUID();
    const quote = estimate.raw?.estimate || estimate.raw?.data?.estimate || estimate.raw?.data || estimate.raw;
    const bet = {
      estimate: quote,
      duelId: market.duelId,
      duelType: "prediction",
      bet: optionLabel,
      optionIndex: pick,
      betAmount: amountWei,
      betAmountUsdc: amountWei,
      slippageBps: 100,
      collateralMode: market.raw?.collateralMode || market.raw?.collateral_mode || undefined,
    };

    try {
      await placeBentoBet({ token, idempotencyKey, bet });
      const receipt = {
        duelId: market.duelId,
        market: market.title,
        outcome: optionLabel,
        stake: `${formatMoney(stake)} USDC`,
        shares: estimate.sharesOut ? weiToHuman(estimate.sharesOut) : "pending",
        quoteId: estimate.quoteId || "sdk",
        idempotencyKey,
        account: managedAccount || "Market account",
      };
      setSettlement({
        tone: "won",
        icon: <ShieldCheck size={18} />,
        title: "Ticket locked",
        body: "Your position is live. We are refreshing your account until the market catches up.",
        payout: "Pending",
        receipt,
      });
      setFeed((items) => [{ minute: "now", label: `${optionLabel} ticket locked for market ${market.duelId}` }, ...items].slice(0, 6));
      showToast("Ticket locked");
      reconcilePortfolio(0);
    } catch (error) {
      showToast(error.message);
    } finally {
      setPlacing(false);
    }
  };

  const refreshPortfolio = async () => {
    try {
      const nextPortfolio = await fetchBentoPortfolio({ token, account: managedAccount });
      setPortfolio(nextPortfolio);
      return nextPortfolio;
    } catch {
      return null;
    }
  };

  const reconcilePortfolio = (attempt) => {
    window.clearTimeout(reconcileTimer.current);
    reconcileTimer.current = window.setTimeout(async () => {
      const nextPortfolio = await refreshPortfolio();
      if (nextPortfolio) {
        setSettlement((value) => ({
          ...value,
          title: attempt > 0 ? "Account refreshed" : value.title,
          body: "Your account has refreshed. Final result updates when the market settles.",
        }));
      }
      if (attempt < 4) reconcilePortfolio(attempt + 1);
    }, attempt === 0 ? 1200 : 3500);
  };

  const nextMarket = () => {
    setMarketIndex((value) => (markets.length ? (value + 1) % markets.length : 0));
  };

  const previousMarket = () => {
    setMarketIndex((value) => (markets.length ? (value - 1 + markets.length) % markets.length : 0));
  };

  const openProfileModal = (mode) => {
    setProfileMode(mode);
    if (activeProfile) {
      setProfileDraft({ name: activeProfile.name, team: activeProfile.team, style: activeProfile.style });
    }
    setProfileModalOpen(true);
    setProfileMenuOpen(false);
  };

  const saveProfile = (event) => {
    event.preventDefault();
    const cleanName = profileDraft.name.trim();
    if (!cleanName) {
      showToast("Add a profile name");
      return;
    }

    const existing = profileMode !== "onboarding" && activeProfile;
    const nextProfile = normalizeProfile(existing
      ? { ...activeProfile, name: cleanName, team: profileDraft.team, style: profileDraft.style }
      : {
          id: `${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
          name: cleanName,
          team: profileDraft.team,
          style: profileDraft.style,
          wins: 0,
          losses: 0,
          points: 1200 + Math.floor(Math.random() * 420),
          streak: 0,
        });

    setProfiles((items) => existing ? items.map((item) => item.id === activeProfile.id ? nextProfile : item) : [...items, nextProfile]);
    saveLeaderboardUser(nextProfile)
      .then((saved) => setProfiles((items) => items.map((item) => item.id === saved.id ? normalizeProfile(saved) : item)))
      .catch(() => showToast("Profile saved locally only"));
    setActiveProfileId(nextProfile.id);
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, nextProfile.id);
    setProfileDraft({ name: "", team: profileDraft.team, style: profileDraft.style });
    setProfileModalOpen(false);
    setFeed((items) => [{ minute: "now", label: existing ? `${cleanName} updated their fan profile` : `${cleanName} joined the leaderboard` }, ...items].slice(0, 6));
    showToast(existing ? "Profile updated" : "Profile created");
  };

  const statusCards = [
    {
      icon: <Clock3 size={18} />,
      label: "Match Board",
      value: marketsLoading ? "Loading" : `${markets.length} markets`,
      body: "World Cup markets load before you connect a wallet.",
    },
    {
      icon: <Gauge size={18} />,
      label: "Ticket",
      value: estimate ? "Ready" : "Required",
      body: "Preview shares and price before locking a pick.",
    },
    {
      icon: <ShieldCheck size={18} />,
      label: "Result",
      value: "Tracked",
      body: "Your account refreshes after every locked ticket.",
    },
  ];

  return (
    <main className="app-shell">
      <section className="phone-frame" aria-label="haramball.xyz World Cup app">
        <div className="phone-screen">
          <header className="match-hero">
            <nav className="topbar" aria-label="Match controls">
              <div className="brand">
                <span className="logo-mark" aria-hidden="true">
                  <span className="logo-mi">hb</span>
                  <span className="logo-bolt" />
                </span>
                <span>haramball.xyz</span>
              </div>
              <div className={readiness.configured ? "live-pill" : "live-pill offline"}>
                {readiness.configured ? <Wifi size={14} /> : <WifiOff size={14} />}
                {readiness.configured ? "Live board" : "Setup"}
              </div>
              <div className="profile-menu-wrap">
                <button className="profile-icon-button" onClick={() => activeProfile ? setProfileMenuOpen((value) => !value) : openProfileModal("onboarding")} type="button">
                  {activeProfile ? initials(activeProfile.name) : <UserCircle size={20} />}
                </button>
                {profileMenuOpen ? (
                  <div className="profile-dropdown">
                    <div className="profile-dropdown-head">
                      <strong>{activeProfile.name}</strong>
                      <span>{activeProfile.team} - {activeProfile.style}</span>
                    </div>
                    <button onClick={() => openProfileModal("edit")} type="button">
                      <UserCircle size={15} />
                      Profile
                    </button>
                    <button onClick={() => openProfileModal("settings")} type="button">
                      <Settings size={15} />
                      Settings
                    </button>
                    <button onClick={() => setTheme((value) => value === "classic" ? "night" : "classic")} type="button">
                      <Palette size={15} />
                      Theme: {theme === "classic" ? "Classic" : "Night"}
                    </button>
                  </div>
                ) : null}
              </div>
            </nav>

            <div className="scoreline">
              <Team name="World" sublabel="Markets" stat={marketsLoading ? "..." : markets.length} />
              <div className="score">CUP</div>
              <Team name="Cup" sublabel="Mode" stat="Live" align="right" />
            </div>

            <div className="ticker">
              <div className="minute">
                <strong>{market ? `#${marketIndex + 1}` : "--"}</strong>
                <span>{market ? market.category : "Matchday market board"}</span>
              </div>
              <div className="balance-card">
                <span>{activeProfile ? activeProfile.team : "Join market"}</span>
                <strong>{activeProfile ? activeProfile.name : "Create"}</strong>
              </div>
            </div>
          </header>

          <section className="play-stack">
            <section className="session-strip" aria-label="Match session setup">
              <p className="session-note">
                {readiness.configured
                  ? "Match board is live and ready."
                  : `Market board setup needed: ${readiness.missing.join(", ")}.`}
              </p>
              <p className="session-note secondary">
                {wallet
                  ? `${authMode === "wallet" ? "Trading wallet" : "Linked wallet"} ${shortAddress(wallet)}`
                  : activeProfile
                    ? `${activeProfile.name} is ready. Connect wallet when placing a ticket.`
                    : "Create a fan profile to join the board."}
              </p>
              <p className="session-note secondary">
                {managedAccount
                  ? `Market account ${shortAddress(managedAccount)}`
                  : "Your market account appears after wallet login."}
              </p>
              {marketError ? <p className="state-note">{marketError}</p> : null}
            </section>

            <article className="cycle-card is-action">
              <div className="phase-row">
                <span>{ready ? "World Cup prediction market" : "Match board pending"}</span>
                <strong>{market?.status || "idle"}</strong>
              </div>

              <div className="timer-block">
                <div className="timer-label">
                  <span>Market ID</span>
                  <b>{market?.duelId || "--"}</b>
                </div>
                <div className="progress-track">
                  <span style={{ width: estimate ? "72%" : pick !== null ? "42%" : "18%" }} />
                </div>
              </div>

              <div className="question-block">
                <span className="category">{market?.category || "Prediction"}</span>
                <h1>{marketTitle}</h1>
                <p>{marketBody}</p>
              </div>

              <div className="stake-block">
                <div className="stake-label">
                  <span>Stake</span>
                  <strong>{formatMoney(stake)} USDC</strong>
                </div>
                <label className="stake-input-wrap">
                  <Coins size={16} />
                  <input
                    disabled={!market || placing}
                    inputMode="decimal"
                    min="0.01"
                    onChange={(event) => setStake(event.target.value)}
                    placeholder="Type any amount"
                    step="0.01"
                    type="number"
                    value={stake}
                  />
                  <span>USDC</span>
                </label>
                <div className="chip-grid">
                  {["1", "2.5", "5", "10"].map((amount) => (
                    <button
                      className={stake === amount ? "chip active" : "chip"}
                      disabled={!market || placing}
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
                <button className="decision yes" disabled={!market || estimateLoading || placing} onClick={() => quotePick(0)} type="button">
                  <Check size={22} />
                  {market?.optionA || "YES"}
                </button>
                <button className="decision no" disabled={!market || estimateLoading || placing} onClick={() => quotePick(1)} type="button">
                  <X size={22} />
                  {market?.optionB || "NO"}
                </button>
              </div>

              <div className="market-nav">
                <button className="chip" disabled={markets.length < 2} onClick={previousMarket} type="button">
                  Previous
                </button>
                <button className="activate-button" disabled={!estimate || placing} onClick={submitBet} type="button">
                  <Lock size={17} />
                  {placing ? "Locking ticket" : "Lock Ticket"}
                </button>
                <button className="chip" disabled={markets.length < 2} onClick={nextMarket} type="button">
                  Next
                </button>
              </div>
            </article>

            <SettlementCard settlement={settlement} />
            <FeedCard feed={feed} portfolio={portfolio} />
            <LeaderboardCard profiles={leaderboard} />
          </section>
        </div>
      </section>

      <aside className="desktop-panel">
        <section className="intro-panel">
          <div className="eyebrow">
            <Flame size={16} />
            World Cup market rush
          </div>
          <h2>Pick the moment before the stadium does.</h2>
          <p>
            haramball.xyz is a fast World Cup market board for quick YES/NO calls, clean tickets, and live account refreshes.
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

        <section className="architecture-panel">
          <h2>Matchday Flow</h2>
          <div className="rail-item">
            <BadgeDollarSign size={18} />
            <span>Live market board loads before wallet connection</span>
          </div>
          <div className="rail-item">
            <Zap size={18} />
            <span>One wallet signature opens the market account</span>
          </div>
          <div className="rail-item">
            <Trophy size={18} />
            <span>Preview, lock, and track every ticket clearly</span>
          </div>
        </section>

        <LeaderboardCard profiles={leaderboard} wide />
      </aside>

      {profileModalOpen ? (
        <OnboardingModal
          activeProfile={activeProfile}
          authMode={authMode}
          connectWallet={connectWallet}
          connectWithWalletLink={connectWithWalletLink}
          draft={profileDraft}
          linkLoading={linkLoading}
          mode={profileMode}
          setDraft={setProfileDraft}
          onClose={() => activeProfile && setProfileModalOpen(false)}
          onSubmit={saveProfile}
          wallet={wallet}
          walletLoading={walletLoading}
          walletOptions={walletOptions}
        />
      ) : null}

      <div className={toast ? "toast show" : "toast"}>{toast}</div>
    </main>
  );
}

function LeaderboardCard({ profiles, wide = false }) {
  return (
    <article className={`leaderboard-card ${wide ? "wide" : ""}`}>
      <h2>
        <Trophy size={17} />
        World Cup Leaderboard
      </h2>
      <div className="leaderboard-list">
        {profiles.map((profile, index) => (
          <div className="leaderboard-row" key={profile.id}>
            <span className={`rank rank-${index + 1}`}>{index < 3 ? <Medal size={15} /> : index + 1}</span>
            <div>
              <strong>{profile.name}</strong>
              <small>{profile.team} - {profile.style} - {profile.wins}-{profile.losses}</small>
            </div>
            <b>{profile.wins}W</b>
          </div>
        ))}
      </div>
    </article>
  );
}

function OnboardingModal({
  activeProfile,
  authMode,
  connectWallet,
  connectWithWalletLink,
  draft,
  linkLoading,
  mode,
  onClose,
  onSubmit,
  setDraft,
  wallet,
  walletLoading,
  walletOptions,
}) {
  const isOnboarding = mode === "onboarding";
  const isSettings = mode === "settings";
  const title = isOnboarding ? "Join Matchday" : isSettings ? "Account Settings" : "Edit Fan Profile";
  const body = isOnboarding
    ? "Create a fan profile first. Connect your wallet now or later when you are ready to lock a ticket."
    : isSettings
      ? "Manage your matchday identity and wallet connection."
      : "Update how you show up on the leaderboard.";

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="onboarding-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-hero">
          <div>
            <span className="category">World Cup</span>
            <h2>{title}</h2>
            <p>{body}</p>
          </div>
          <button className="profile-icon-button modal-close" disabled={isOnboarding && !activeProfile} onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        {isSettings ? (
          <div className="settings-grid">
            <div className="wallet-selector" aria-label="Choose wallet">
              <strong>Choose wallet</strong>
              {walletOptions.length ? (
                walletOptions.map((option) => (
                  <button
                    className="wallet-option available"
                    disabled={walletLoading}
                    key={option.id}
                    onClick={() => connectWallet(option)}
                    type="button"
                  >
                    <span>{option.name}</span>
                    <small>{walletLoading ? "Connecting" : option.hint}</small>
                  </button>
                ))
              ) : (
                <div className="wallet-empty">
                  <strong>No browser wallet found</strong>
                  <span>Open wallet link or install MetaMask, Rabby, Coinbase Wallet, or another EVM wallet.</span>
                </div>
              )}
            </div>
            <button className="wallet-button alt" onClick={connectWithWalletLink} disabled={linkLoading} type="button">
              <Wallet size={17} />
              {linkLoading ? "Opening link" : "Open wallet link"}
            </button>
            <div className="settings-note">
              <strong>{activeProfile?.name || "No profile yet"}</strong>
              <span>
                {wallet
                  ? `${authMode === "wallet" ? "Trading wallet" : "Linked wallet"} ${shortAddress(wallet)}`
                  : "Use wallet link if no extension appears in this browser."}
              </span>
            </div>
          </div>
        ) : null}

        {!isSettings ? (
          <ProfileBuilder
            activeProfile={activeProfile}
            draft={draft}
            setDraft={setDraft}
            onSubmit={onSubmit}
            submitLabel={isOnboarding ? "Enter Matchday" : "Save Profile"}
          />
        ) : (
          <ProfileBuilder
            activeProfile={activeProfile}
            draft={draft}
            setDraft={setDraft}
            onSubmit={onSubmit}
            submitLabel="Save Profile"
          />
        )}
      </section>
    </div>
  );
}

function ProfileBuilder({ draft, setDraft, onSubmit, activeProfile, submitLabel = "Create Profile", wide = false }) {
  return (
    <article className={`profile-card ${wide ? "wide" : ""}`}>
      <h2>
        <UserPlus size={17} />
        Create Fan Profile
      </h2>
      {activeProfile ? (
        <div className="profile-preview">
          <span>{initials(activeProfile.name)}</span>
          <div>
            <strong>{activeProfile.name}</strong>
            <small>{activeProfile.team} - {activeProfile.style} - {activeProfile.wins} wins</small>
          </div>
        </div>
      ) : null}
      <form className="profile-form" onSubmit={onSubmit}>
        <label>
          <span>Name</span>
          <input
            maxLength={18}
            onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))}
            placeholder="Your matchday name"
            value={draft.name}
          />
        </label>
        <label>
          <span>Team</span>
          <select onChange={(event) => setDraft((value) => ({ ...value, team: event.target.value }))} value={draft.team}>
            {["USA", "Argentina", "Brazil", "England", "France", "Germany", "Japan", "Morocco"].map((team) => (
              <option key={team}>{team}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Style</span>
          <select onChange={(event) => setDraft((value) => ({ ...value, style: event.target.value }))} value={draft.style}>
            {["Striker", "Midfield", "Defense", "Chaos", "Underdog"].map((style) => (
              <option key={style}>{style}</option>
            ))}
          </select>
        </label>
        <button className="activate-button" type="submit">
          <UserPlus size={17} />
          {submitLabel}
        </button>
      </form>
    </article>
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

function SettlementCard({ settlement }) {
  return (
    <article className="settlement-card">
      <h2>Match Ticket</h2>
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
            <span>{settlement.receipt.outcome} on market {settlement.receipt.duelId}</span>
            <ChevronDown size={16} />
          </summary>
          <div className="receipt-grid" aria-label="Match ticket receipt">
            {Object.entries(settlement.receipt).map(([key, value]) => (
              <div className={key === "market" ? "receipt-rule" : ""} key={key}>
                <span>{receiptLabel(key)}</span>
                <strong>{String(value)}</strong>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}

function FeedCard({ feed, portfolio }) {
  return (
    <article className="feed-card">
      <h2>Match Activity</h2>
      <div className="feed-list">
        {feed.length === 0 ? (
          <div className="feed-item empty">
            <strong>--</strong>
            <span>Waiting for match market activity</span>
          </div>
        ) : (
          feed.map((item, index) => (
            <div className="feed-item" key={`${item.minute}-${item.label}-${index}`}>
              <strong>{item.minute}</strong>
              <span>{item.label}</span>
            </div>
          ))
        )}
        {portfolio ? (
          <div className="feed-item">
            <strong>acct</strong>
            <span>Account refreshed</span>
          </div>
        ) : null}
      </div>
    </article>
  );
}

async function discoverEvmWalletOptions() {
  const browserWindow = typeof window === "undefined" ? {} : window;
  const announced = [];

  const onProvider = (event) => {
    if (event?.detail?.provider) announced.push(event.detail);
  };

  if (browserWindow.addEventListener && browserWindow.dispatchEvent) {
    browserWindow.addEventListener("eip6963:announceProvider", onProvider);
    browserWindow.dispatchEvent(new Event("eip6963:requestProvider"));
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    browserWindow.removeEventListener("eip6963:announceProvider", onProvider);
  }

  const ethereum = safeRead(() => browserWindow.ethereum);
  const legacyProviders = Array.isArray(ethereum?.providers) && ethereum.providers.length
    ? ethereum.providers
    : ethereum
      ? [ethereum]
      : [];
  const entries = [
    ...announced.map((detail, index) => ({
      id: detail.info?.uuid || `eip6963-${index}`,
      name: detail.info?.name || evmWalletName(detail.provider, index),
      provider: detail.provider,
      icon: detail.info?.icon,
      source: "eip6963",
    })),
    ...legacyProviders.map((provider, index) => ({
      id: `legacy-${index}-${evmWalletName(provider, index)}`,
      name: evmWalletName(provider, index),
      provider,
      source: "legacy",
    })),
  ];
  const seen = new Set();

  return entries
    .map((entry, index) => {
      const key = `${entry.name}-${providerFingerprint(entry.provider)}`;
      if (seen.has(key)) return null;
      if (entry.source === "legacy" && entries.some((item) => item.source === "eip6963" && item.name === entry.name)) return null;
      seen.add(key);
      const name = entry.name;
      return {
        id: entry.id || `${name}-${index}`,
        name,
        provider: entry.provider,
        hint: entry.source === "eip6963" ? "Detected" : entry.provider?.isConnected?.() ? "Available" : "Detected",
      };
    })
    .filter(Boolean);
}

function evmWalletName(provider, index) {
  if (provider?.isRabby) return "Rabby";
  if (provider?.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider?.isMetaMask && provider?.isBraveWallet) return "Brave Wallet";
  if (provider?.isMetaMask) return "MetaMask";
  if (provider?.isTrust) return "Trust Wallet";
  if (provider?.isFrame) return "Frame";
  if (provider?.isOKExWallet || provider?.isOkxWallet) return "OKX Wallet";
  return index === 0 ? "Browser Wallet" : `Wallet ${index + 1}`;
}

function providerFingerprint(provider) {
  return [
    provider?.isMetaMask ? "metamask" : "",
    provider?.isRabby ? "rabby" : "",
    provider?.isCoinbaseWallet ? "coinbase" : "",
    provider?.isTrust ? "trust" : "",
    provider?.isBraveWallet ? "brave" : "",
    provider?.isFrame ? "frame" : "",
    provider?.isOKExWallet || provider?.isOkxWallet ? "okx" : "",
  ].filter(Boolean).join("-") || "generic";
}

function walletErrorMessage(error) {
  const message = String(error?.message || "").trim();
  const code = error?.code;

  if (code === 4001 || /reject|denied|cancel/i.test(message)) {
    return "Wallet connection cancelled";
  }

  return message || "Wallet connection failed";
}

function safeRead(read) {
  try {
    return read();
  } catch {
    return null;
  }
}

function receiptLabel(key) {
  return (
    {
      duelId: "market id",
      quoteId: "preview id",
      idempotencyKey: "ticket id",
    }[key] || key
  );
}

function loadProfiles() {
  try {
    const stored = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "null");
    return Array.isArray(stored) && stored.length ? stored.map(normalizeProfile) : DEFAULT_PROFILES;
  } catch {
    return DEFAULT_PROFILES;
  }
}

function normalizeProfile(profile = {}) {
  const [recordWins, recordLosses] = String(profile.record || "").split("-");
  const wins = numberOr(profile.wins, recordWins, 0);
  const losses = numberOr(profile.losses, recordLosses, 0);

  return {
    id: profile.id,
    name: profile.name,
    team: profile.team || "USA",
    style: profile.style || "Striker",
    wins,
    losses,
    points: numberOr(profile.points, undefined, 1200 + wins * 80 - losses * 20),
    streak: numberOr(profile.streak, undefined, 0),
  };
}

function numberOr(value, fallbackValue, finalFallback) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  const fallback = Number(fallbackValue);
  return Number.isFinite(fallback) ? fallback : finalFallback;
}

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

createRoot(document.getElementById("root")).render(<App />);
