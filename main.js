/**
 * Zombie Arena (좀비 아레나)
 * ------------------------------------------------------------
 * Original Copyright Notice
 *
 * Copyright (c) 2025 Euiyun Kim (geniuskey@gmail.com)
 *
 * This web application is an original creation by the developer known as
 * "geniuskey". Any third-party registration of this work, including copyright
 * filings made without the author's consent, does not invalidate the author's
 * original rights under Korean Copyright Law and international copyright
 * principles.
 *
 * Notes:
 * - Copyright is automatically granted upon creation (“무조건 자동 발생”).
 * - Copyright registration by unrelated parties does NOT transfer ownership.
 * - MIT License permits reuse but does NOT abandon authorship or ownership.
 * - Unauthorized registration by third parties shall be considered invalid.
 *
 * Original Creator: Euiyun Kim (geniuskey@gmail.com)
 * Service Web Page: https://geniuskey.github.io/zombie-area/
 * ------------------------------------------------------------
 */

class ZombieSurvival {
	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.participants = [];
		this.entities = [];
		this.infectedOrder = [];
		this.isRunning = false;
		this.gameSpeed = 1;
		this.startTime = 0;
		this.zombieCount = 2;
		this.humanFovAngle = 120;
		this.zombieFovAngle = 90;
		this.entityRadius = 12;
		this.humanWalkSpeed = 0.8;
		this.humanRunSpeed = 2.0;
		this.zombieWalkSpeed = 0.6;
		this.zombieChaseSpeed = 1.2;
		this.maxStamina = 100;
		this.staminaDrain = 0.4;
		this.staminaRecovery = 0.25;
		this.humanDetectRange = 300;
		this.zombieDetectRange = 300;
		this.humanColors = ['#4CAF50','#2196F3','#FF9800','#9C27B0','#00BCD4','#FFEB3B','#E91E63','#3F51B5','#009688','#FF5722','#607D8B','#8BC34A'];
		this.zombieNames = ['좀비A','좀비B','좀비C','좀비D','좀비E','좀비F','좀비G','좀비H','좀비I','좀비J'];
		this.setupCanvas();
		this.bindEvents();
	}
	setupCanvas() {
		const wrapper = this.canvas.parentElement;
		this.arenaWidth = wrapper.clientWidth - 4;
		this.arenaHeight = wrapper.clientHeight - 4;
		this.canvas.width = this.arenaWidth;
		this.canvas.height = this.arenaHeight;
	}
	bindEvents() {
		let resizeTimeout;
		window.addEventListener('resize', () => {
			clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(() => {
				this.setupCanvas();
				if (!this.isRunning) this.redistributeEntities();
				this.draw();
			}, 100);
		});
	}
	redistributeEntities() {
		const padding = 60;
		for (const e of this.entities) {
			e.x = Math.min(Math.max(e.x, padding), this.arenaWidth - padding);
			e.y = Math.min(Math.max(e.y, padding), this.arenaHeight - padding);
		}
	}
	setParticipants(names) {
		this.participants = names.filter(n => n.trim());
		this.reset();
	}
	reset() {
		this.isRunning = false;
		this.entities = [];
		this.infectedOrder = [];
		this.startTime = 0;
		this.setupCanvas();
		this.setupEntities();
		this.draw();
		this.updateUI();
	}
	setupEntities() {
		this.entities = [];
		const padding = 60;
		const shuffled = [...this.participants].sort(() => Math.random() - 0.5);
		const totalCount = shuffled.length + this.zombieCount;
		const positions = this.generateSpacedPositions(totalCount, padding);
		for (let i = 0; i < shuffled.length; i++) {
			this.entities.push({
				name: shuffled[i], x: positions[i].x, y: positions[i].y,
				vx: 0, vy: 0, angle: Math.random() * Math.PI * 2,
				isZombie: false, stamina: this.maxStamina, isRunning: false,
				color: this.humanColors[i % this.humanColors.length],
				targetAngle: Math.random() * Math.PI * 2,
				wanderTimer: Math.random() * 120, hasTarget: false, isInitialZombie: false
			});
		}
		for (let i = 0; i < this.zombieCount; i++) {
			const pos = positions[shuffled.length + i];
			this.entities.push({
				name: this.zombieNames[i] || ('좀비' + (i+1)),
				x: pos.x, y: pos.y, vx: 0, vy: 0,
				angle: Math.random() * Math.PI * 2,
				isZombie: true, stamina: this.maxStamina, isRunning: false, color: '#666',
				targetAngle: Math.random() * Math.PI * 2,
				wanderTimer: Math.random() * 120, hasTarget: false, isInitialZombie: true
			});
		}
	}
	generateSpacedPositions(count, padding) {
		const positions = [];
		const minDist = 80;
		for (let i = 0; i < count; i++) {
			let bestPos = null, bestMinDist = 0;
			for (let attempt = 0; attempt < 100; attempt++) {
				const pos = {
					x: padding + Math.random() * (this.arenaWidth - padding * 2),
					y: padding + Math.random() * (this.arenaHeight - padding * 2)
				};
				let minDistToOthers = Infinity;
				for (const other of positions) {
					const dx = pos.x - other.x, dy = pos.y - other.y;
					minDistToOthers = Math.min(minDistToOthers, Math.sqrt(dx*dx + dy*dy));
				}
				if (minDistToOthers > bestMinDist) { bestMinDist = minDistToOthers; bestPos = pos; }
				if (minDistToOthers >= minDist) break;
			}
			positions.push(bestPos || { x: padding + Math.random() * (this.arenaWidth - padding * 2), y: padding + Math.random() * (this.arenaHeight - padding * 2) });
		}
		return positions;
	}
	start() {
		if (this.participants.length < 2) { alert('최소 2명 이상의 참여자가 필요합니다!'); return; }
		this.reset();
		this.isRunning = true;
		this.startTime = Date.now();
		this.setControlsDisabled(true);
		this.gameLoop();
	}
	stop() { this.isRunning = false; this.setControlsDisabled(false); }
	setControlsDisabled(disabled) {
		document.getElementById('zombieCount').disabled = disabled;
		document.getElementById('fovAngle').disabled = disabled;
		document.getElementById('zombieFovAngle').disabled = disabled;
		document.querySelectorAll('.speed-btn').forEach(btn => btn.disabled = disabled);
	}
	gameLoop() {
		if (!this.isRunning) return;
		for (let i = 0; i < this.gameSpeed; i++) this.update();
		this.draw();
		this.updateUI();
		const humans = this.entities.filter(e => !e.isZombie);
		if (humans.length <= 1 && this.isRunning) { this.endGame(humans[0]); return; }
		requestAnimationFrame(() => this.gameLoop());
	}
	update() {
		const humans = this.entities.filter(e => !e.isZombie);
		const zombies = this.entities.filter(e => e.isZombie);
		for (const entity of this.entities) {
			if (entity.isZombie) this.updateZombie(entity, humans);
			else this.updateHuman(entity, zombies);
			entity.x += entity.vx; entity.y += entity.vy;
			entity.vx *= 0.98; entity.vy *= 0.98;
			const r = this.entityRadius;
			if (entity.x < r) { entity.x = r; entity.vx *= -0.5; }
			if (entity.x > this.arenaWidth - r) { entity.x = this.arenaWidth - r; entity.vx *= -0.5; }
			if (entity.y < r) { entity.y = r; entity.vy *= -0.5; }
			if (entity.y > this.arenaHeight - r) { entity.y = this.arenaHeight - r; entity.vy *= -0.5; }
		}
		this.checkInfections(humans, zombies);
		this.handleCollisions();
	}
	isInFieldOfView(viewer, target, fovAngle) {
		const dx = target.x - viewer.x, dy = target.y - viewer.y;
		const angleToTarget = Math.atan2(dy, dx);
		let angleDiff = angleToTarget - viewer.angle;
		while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
		while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
		return Math.abs(angleDiff) < (fovAngle / 2) * (Math.PI / 180);
	}
	updateZombie(zombie, humans) {
		if (humans.length === 0) return;
		let closestVisible = null, closestVisibleDist = Infinity;
		for (const human of humans) {
			const dx = human.x - zombie.x, dy = human.y - zombie.y;
			const dist = Math.sqrt(dx*dx + dy*dy);
			if (dist < this.zombieDetectRange && this.isInFieldOfView(zombie, human, this.zombieFovAngle)) {
				if (dist < closestVisibleDist) { closestVisibleDist = dist; closestVisible = human; }
			}
		}
		if (closestVisible) {
			zombie.hasTarget = true;
			const dx = closestVisible.x - zombie.x, dy = closestVisible.y - zombie.y;
			const targetAngle = Math.atan2(dy, dx);
			let angleDiff = targetAngle - zombie.angle;
			while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
			while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
			zombie.angle += angleDiff * 0.1;
			zombie.vx = Math.cos(zombie.angle) * this.zombieChaseSpeed;
			zombie.vy = Math.sin(zombie.angle) * this.zombieChaseSpeed;
		} else {
			zombie.hasTarget = false;
			zombie.wanderTimer--;
			if (zombie.wanderTimer <= 0) { zombie.targetAngle = Math.random() * Math.PI * 2; zombie.wanderTimer = 90 + Math.random() * 150; }
			let angleDiff = zombie.targetAngle - zombie.angle;
			while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
			while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
			zombie.angle += angleDiff * 0.03;
			zombie.vx = Math.cos(zombie.angle) * this.zombieWalkSpeed;
			zombie.vy = Math.sin(zombie.angle) * this.zombieWalkSpeed;
		}
	}
	updateHuman(human, zombies) {
		let nearestVisibleZombie = null, nearestDist = Infinity;
		for (const zombie of zombies) {
			const dx = zombie.x - human.x, dy = zombie.y - human.y;
			const dist = Math.sqrt(dx*dx + dy*dy);
			if (dist < this.humanDetectRange && this.isInFieldOfView(human, zombie, this.humanFovAngle)) {
				if (dist < nearestDist) { nearestDist = dist; nearestVisibleZombie = zombie; }
			}
		}
		if (nearestVisibleZombie) {
			human.isRunning = human.stamina > 0;
			const dx = human.x - nearestVisibleZombie.x, dy = human.y - nearestVisibleZombie.y;
			let escapeAngle = Math.atan2(dy, dx);
			const otherHumans = this.entities.filter(e => !e.isZombie && e !== human);
			if (otherHumans.length > 0 && Math.random() < 0.2) {
				const candidates = otherHumans.filter(other => {
					const toOther = Math.atan2(other.y - human.y, other.x - human.x);
					const toZombie = Math.atan2(nearestVisibleZombie.y - human.y, nearestVisibleZombie.x - human.x);
					let diff = Math.abs(toOther - toZombie);
					if (diff > Math.PI) diff = Math.PI * 2 - diff;
					return diff > Math.PI / 3;
				});
				if (candidates.length > 0) {
					const target = candidates[Math.floor(Math.random() * candidates.length)];
					const toTarget = Math.atan2(target.y - human.y, target.x - human.x);
					escapeAngle = escapeAngle * 0.6 + toTarget * 0.4;
				}
			}
			escapeAngle += (Math.random() - 0.5) * 0.4;
			let angleDiff = escapeAngle - human.angle;
			while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
			while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
			human.angle += angleDiff * 0.15;
			const speed = human.isRunning ? this.humanRunSpeed : this.humanWalkSpeed;
			human.vx = Math.cos(human.angle) * speed;
			human.vy = Math.sin(human.angle) * speed;
			if (human.isRunning) human.stamina = Math.max(0, human.stamina - this.staminaDrain);
		} else {
			human.isRunning = false;
			human.stamina = Math.min(this.maxStamina, human.stamina + this.staminaRecovery);
			human.wanderTimer--;
			if (human.wanderTimer <= 0) { human.targetAngle = Math.random() * Math.PI * 2; human.wanderTimer = 80 + Math.random() * 160; }
			let angleDiff = human.targetAngle - human.angle;
			while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
			while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
			human.angle += angleDiff * 0.04;
			human.vx = Math.cos(human.angle) * this.humanWalkSpeed * 0.6;
			human.vy = Math.sin(human.angle) * this.humanWalkSpeed * 0.6;
		}
	}
	checkInfections(humans, zombies) {
		for (const human of humans) {
			for (const zombie of zombies) {
				const dx = human.x - zombie.x, dy = human.y - zombie.y;
				if (Math.sqrt(dx*dx + dy*dy) < this.entityRadius * 2.2) {
					human.isZombie = true; human.color = '#666'; human.hasTarget = false; human.wanderTimer = 60;
					this.infectedOrder.push({ name: human.name, time: Date.now() - this.startTime });
					this.updateRanking();
				}
			}
		}
	}
	handleCollisions() {
		for (let i = 0; i < this.entities.length; i++) {
			for (let j = i + 1; j < this.entities.length; j++) {
				const a = this.entities[i], b = this.entities[j];
				if (a.isZombie !== b.isZombie) continue;
				const dx = b.x - a.x, dy = b.y - a.y;
				const dist = Math.sqrt(dx*dx + dy*dy);
				const minDist = this.entityRadius * 2.5;
				if (dist < minDist && dist > 0) {
					const overlap = (minDist - dist) / 2;
					const nx = dx / dist, ny = dy / dist;
					a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5;
					b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5;
				}
			}
		}
	}
	draw() {
		const ctx = this.ctx;
		ctx.fillStyle = '#111a11';
		ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		ctx.strokeStyle = 'rgba(100, 255, 100, 0.08)';
		ctx.lineWidth = 1;
		for (let x = 0; x < this.canvas.width; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.canvas.height); ctx.stroke(); }
		for (let y = 0; y < this.canvas.height; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.canvas.width, y); ctx.stroke(); }
		ctx.strokeStyle = 'rgba(100, 255, 100, 0.4)';
		ctx.lineWidth = 3;
		ctx.strokeRect(1.5, 1.5, this.canvas.width - 3, this.canvas.height - 3);
		const humans = this.entities.filter(e => !e.isZombie);
		const zombies = this.entities.filter(e => e.isZombie);
		for (const e of humans) this.drawEntity(e);
		for (const e of zombies) this.drawEntity(e);
	}
	drawEntity(entity) {
		const ctx = this.ctx, x = entity.x, y = entity.y, r = this.entityRadius;
		ctx.save();
		ctx.translate(x, y);
		if (entity.isZombie) {
			if (!entity.hasTarget) {
				ctx.rotate(entity.angle);
				const fovRad = (this.zombieFovAngle / 2) * (Math.PI / 180);
				ctx.fillStyle = 'rgba(255, 50, 50, 0.06)';
				ctx.beginPath(); ctx.moveTo(0, 0);
				ctx.arc(0, 0, this.zombieDetectRange, -fovRad, fovRad);
				ctx.closePath(); ctx.fill();
				ctx.rotate(-entity.angle);
			}
			ctx.rotate(entity.angle);
			ctx.fillStyle = '#4a5d4a';
			ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = '#3d4d3d';
			ctx.beginPath(); ctx.ellipse(0, 0, r * 0.75, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = '#5a6b5a';
			ctx.beginPath(); ctx.arc(r * 0.5, 0, r * 0.42, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = entity.hasTarget ? '#ff0000' : '#ff4444';
			ctx.shadowColor = entity.hasTarget ? '#ff0000' : 'transparent';
			ctx.shadowBlur = entity.hasTarget ? 8 : 0;
			ctx.beginPath(); ctx.arc(r * 0.55, -r * 0.12, r * 0.1, 0, Math.PI * 2); ctx.arc(r * 0.55, r * 0.12, r * 0.1, 0, Math.PI * 2); ctx.fill();
			ctx.shadowBlur = 0;
			ctx.strokeStyle = '#4a5d4a'; ctx.lineWidth = r * 0.25; ctx.lineCap = 'round';
			if (entity.hasTarget) { ctx.beginPath(); ctx.moveTo(0, -r*0.4); ctx.lineTo(r*0.9, -r*0.2); ctx.moveTo(0, r*0.4); ctx.lineTo(r*0.9, r*0.2); ctx.stroke(); }
			else { ctx.beginPath(); ctx.moveTo(0, -r*0.5); ctx.lineTo(r*0.4, -r*0.6); ctx.moveTo(0, r*0.5); ctx.lineTo(r*0.4, r*0.6); ctx.stroke(); }
		} else {
			ctx.rotate(entity.angle);
			const fovRad = (this.humanFovAngle / 2) * (Math.PI / 180);
			ctx.fillStyle = 'rgba(255, 255, 100, 0.04)';
			ctx.beginPath(); ctx.moveTo(0, 0);
			ctx.arc(0, 0, this.humanDetectRange, -fovRad, fovRad);
			ctx.closePath(); ctx.fill();
			ctx.fillStyle = entity.color;
			ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
			const skinTone = '#FFDAB9';
			ctx.fillStyle = skinTone;
			ctx.beginPath(); ctx.arc(r * 0.4, 0, r * 0.38, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = '#333';
			ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.32, Math.PI * 0.7, -Math.PI * 0.7); ctx.fill();
			ctx.strokeStyle = skinTone; ctx.lineWidth = r * 0.22; ctx.lineCap = 'round';
			if (entity.isRunning) { ctx.beginPath(); ctx.moveTo(-r*0.1, -r*0.5); ctx.lineTo(r*0.5, -r*0.4); ctx.moveTo(-r*0.1, r*0.5); ctx.lineTo(-r*0.4, r*0.6); ctx.stroke(); }
			else { ctx.beginPath(); ctx.moveTo(-r*0.15, -r*0.55); ctx.lineTo(r*0.2, -r*0.65); ctx.moveTo(-r*0.15, r*0.55); ctx.lineTo(r*0.2, r*0.65); ctx.stroke(); }
			ctx.rotate(-entity.angle);
			const barWidth = r * 1.6, barHeight = r * 0.22, barY = -r - barHeight - 4;
			ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
			ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);
			const staminaRatio = entity.stamina / this.maxStamina;
			ctx.fillStyle = staminaRatio > 0.5 ? '#4CAF50' : staminaRatio > 0.25 ? '#ff9800' : '#f44336';
			ctx.fillRect(-barWidth / 2, barY, barWidth * staminaRatio, barHeight);
		}
		ctx.restore();
		ctx.font = 'bold ' + Math.max(9, r * 0.65) + 'px "Noto Sans KR"';
		ctx.textAlign = 'center'; ctx.textBaseline = 'top';
		const shortName = entity.name.length > 8 ? entity.name.slice(0, 7) + '..' : entity.name;
		ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)'; ctx.lineWidth = 3;
		ctx.strokeText(shortName, x, y + r + 5);
		ctx.fillStyle = entity.isZombie ? '#ff6666' : '#fff';
		ctx.fillText(shortName, x, y + r + 5);
	}
	endGame(winner) {
		this.isRunning = false;
		this.setControlsDisabled(false);
		if (winner) {
			const survivalTime = ((Date.now() - this.startTime) / 1000).toFixed(1);
			document.getElementById('winnerName').textContent = winner.name;
			document.getElementById('winnerStats').textContent = '생존 시간: ' + survivalTime + '초';
			document.getElementById('winnerOverlay').classList.add('show');
		}
		this.updateRanking();
	}
	updateRanking() {
		const list = document.getElementById('rankingList');
		if (this.infectedOrder.length === 0 && !this.isRunning) {
			list.innerHTML = '<div class="ranking-placeholder">게임을 시작하면<br>감염 순서가 표시됩니다</div>';
			return;
		}
		let html = '';
		this.infectedOrder.forEach((infected, idx) => {
			const time = (infected.time / 1000).toFixed(1);
			html += '<div class="ranking-item infected"><span class="ranking-rank">' + (idx+1) + '</span><span class="ranking-name">🧟 ' + infected.name + '</span><span class="ranking-status">' + time + 's</span></div>';
		});
		const survivors = this.entities.filter(e => !e.isZombie);
		survivors.forEach(survivor => {
			const isWinner = survivors.length === 1;
			html += '<div class="ranking-item ' + (isWinner ? 'winner' : 'survivor') + '"><span class="ranking-rank">' + (isWinner ? '🏆' : '🧑') + '</span><span class="ranking-name">' + survivor.name + '</span><span class="ranking-status">' + (isWinner ? '승리!' : '생존') + '</span></div>';
		});
		const initialZombies = this.entities.filter(e => e.isInitialZombie);
		if (initialZombies.length > 0) {
			html += '<div style="border-top: 1px solid rgba(255,255,255,0.1); margin: 8px 0; padding-top: 8px; font-size: 0.65rem; color: #666;">초기 좀비</div>';
			initialZombies.forEach(zombie => {
				html += '<div class="ranking-item infected" style="opacity: 0.6;"><span class="ranking-rank">🧟</span><span class="ranking-name">' + zombie.name + '</span><span class="ranking-status">-</span></div>';
			});
		}
		list.innerHTML = html;
	}
	updateUI() {
		const humans = this.entities.filter(e => !e.isZombie);
		const zombies = this.entities.filter(e => e.isZombie);
		document.getElementById('humanCount').textContent = humans.length;
		document.getElementById('zombieCountDisplay').textContent = zombies.length;
	}
}
document.addEventListener('DOMContentLoaded', () => {
	const canvas = document.getElementById('gameCanvas');
	const game = new ZombieSurvival(canvas);
	const participantsInput = document.getElementById('participants');
	const zombieCountSlider = document.getElementById('zombieCount');
	const zombieValueDisplay = document.getElementById('zombieValue');
	const fovSlider = document.getElementById('fovAngle');
	const fovValueDisplay = document.getElementById('fovValue');
	const zombieFovSlider = document.getElementById('zombieFovAngle');
	const zombieFovValueDisplay = document.getElementById('zombieFovValue');
	const startBtn = document.getElementById('startBtn');
	const resetBtn = document.getElementById('resetBtn');
	const helpBtn = document.getElementById('helpBtn');
	const helpModal = document.getElementById('helpModal');
	const closeHelpBtn = document.getElementById('closeHelpBtn');
	const winnerOverlay = document.getElementById('winnerOverlay');
	const closeWinnerBtn = document.getElementById('closeWinnerBtn');
	const speedBtns = document.querySelectorAll('.speed-btn');
	function parseParticipants(text) { return text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean); }
	function updateGame() { game.setParticipants(parseParticipants(participantsInput.value)); }
	participantsInput.addEventListener('input', updateGame);
	zombieCountSlider.addEventListener('input', () => {
		zombieValueDisplay.textContent = zombieCountSlider.value;
		game.zombieCount = parseInt(zombieCountSlider.value);
		if (!game.isRunning) game.reset();
	});
	fovSlider.addEventListener('input', () => { fovValueDisplay.textContent = fovSlider.value + '°'; game.humanFovAngle = parseInt(fovSlider.value); });
	zombieFovSlider.addEventListener('input', () => { zombieFovValueDisplay.textContent = zombieFovSlider.value + '°'; game.zombieFovAngle = parseInt(zombieFovSlider.value); });
	startBtn.addEventListener('click', () => {
		if (parseParticipants(participantsInput.value).length < 2) { alert('최소 2명 이상의 참여자가 필요합니다!'); return; }
		game.setParticipants(parseParticipants(participantsInput.value));
		game.start();
	});
	resetBtn.addEventListener('click', () => { game.stop(); game.reset(); });
	speedBtns.forEach(btn => {
		btn.addEventListener('click', () => {
			if (btn.disabled) return;
			speedBtns.forEach(b => b.classList.remove('active'));
			btn.classList.add('active');
			game.gameSpeed = parseFloat(btn.dataset.speed);
		});
	});
	helpBtn.addEventListener('click', () => helpModal.classList.add('show'));
	closeHelpBtn.addEventListener('click', () => helpModal.classList.remove('show'));
	helpModal.addEventListener('click', (e) => { if (e.target === helpModal) helpModal.classList.remove('show'); });
	closeWinnerBtn.addEventListener('click', () => winnerOverlay.classList.remove('show'));
	const saved = localStorage.getItem('zombie-lottery-participants');
	if (saved) { participantsInput.value = saved; updateGame(); }
	participantsInput.addEventListener('input', () => localStorage.setItem('zombie-lottery-participants', participantsInput.value));
	game.draw();
});