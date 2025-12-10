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
        this.startTime = 0;
        this.endTime = 0; // 게임 종료 시간 저장
        this.zombieCount = 2;
        this.survivorCount = 1;
        this.entityRadius = 10;
        
        // Speed settings
        this.humanWalkSpeed = 0.6;
        this.humanRunSpeed = 2.5;
        this.zombieWalkSpeed = 0.5;
        this.zombieChaseSpeed = 2.0;
        
        // FOV settings - 같은 시야 거리
        this.humanFovAngle = 140;
        this.zombieFovAngle = 80;
        this.detectRange = 250;
        
        this.runDuration = 60;
        
        this.humanColors = ['#4CAF50','#2196F3','#FF9800','#9C27B0','#00BCD4','#FFEB3B','#E91E63','#3F51B5','#009688','#FF5722','#607D8B','#8BC34A'];
        this.zombieNames = ['좀비A','좀비B','좀비C','좀비D','좀비E','좀비F','좀비G','좀비H','좀비I','좀비J'];
        
        // Circular arena shrinking
        this.centerX = 0;
        this.centerY = 0;
        this.currentRadius = 0;
        this.targetRadius = 0;
        this.targetCenterX = 0;
        this.targetCenterY = 0;
        this.shrinkPhase = 0;
        this.shrinkTimer = 0;
        this.shrinkInterval = 600;
        this.shrinkWarningTime = 180;
        this.isShrinking = false;
        
        // Transformation animation
        this.transformingEntities = [];
        
        this.setupCanvas();
        this.bindEvents();
    }
    
    setupCanvas() {
        const wrapper = this.canvas.parentElement;
        this.canvas.width = wrapper.clientWidth;
        this.canvas.height = wrapper.clientHeight;
        
        // 원형 영역 초기화
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        this.currentRadius = Math.min(this.canvas.width, this.canvas.height) / 2 - 15;
        this.targetRadius = this.currentRadius;
        this.targetCenterX = this.centerX;
        this.targetCenterY = this.centerY;
    }
    
    bindEvents() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const oldW = this.canvas.width, oldH = this.canvas.height;
                this.setupCanvas();
                if (!this.isRunning) {
                    this.redistributeEntities(oldW, oldH);
                }
                this.draw();
            }, 100);
        });
    }
    
    redistributeEntities(oldW, oldH) {
        const scaleX = this.canvas.width / oldW;
        const scaleY = this.canvas.height / oldH;
        for (const e of this.entities) {
            e.x *= scaleX;
            e.y *= scaleY;
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
        this.transformingEntities = [];
        this.startTime = 0;
        this.endTime = 0;
        this.shrinkPhase = 0;
        this.shrinkTimer = 0;
        this.isShrinking = false;
        this.setupCanvas();
        this.setupEntities();
        this.draw();
        this.updateUI();
        document.getElementById('shrinkWarning').style.display = 'none';
        document.getElementById('timerDisplay').textContent = '00:00';
    }
    
    setupEntities() {
        this.entities = [];
        const shuffled = [...this.participants].sort(() => Math.random() - 0.5);
        const totalCount = shuffled.length + this.zombieCount;
        const positions = this.generateSpacedPositions(totalCount);
        
        for (let i = 0; i < shuffled.length; i++) {
            this.entities.push({
                name: shuffled[i], x: positions[i].x, y: positions[i].y,
                vx: 0, vy: 0, angle: Math.random() * Math.PI * 2,
                isZombie: false, isRunning: false, runTimer: 0,
                color: this.humanColors[i % this.humanColors.length],
                targetAngle: Math.random() * Math.PI * 2,
                wanderTimer: Math.random() * 120, hasTarget: false, isInitialZombie: false,
                health: 100, isTransforming: false, transformTimer: 0,
                eatingTimer: 0 // 좀비 먹는 시간
            });
        }
        
        for (let i = 0; i < this.zombieCount; i++) {
            const pos = positions[shuffled.length + i];
            this.entities.push({
                name: this.zombieNames[i] || ('좀비' + (i+1)),
                x: pos.x, y: pos.y, vx: 0, vy: 0,
                angle: Math.random() * Math.PI * 2,
                isZombie: true, isRunning: false, runTimer: 0, color: '#666',
                targetAngle: Math.random() * Math.PI * 2,
                wanderTimer: Math.random() * 120, hasTarget: false, isInitialZombie: true,
                health: 100, isTransforming: false, transformTimer: 0,
                eatingTimer: 0
            });
        }
    }
    
    generateSpacedPositions(count) {
        const positions = [];
        const padding = 30;
        
        for (let i = 0; i < count; i++) {
            let bestPos = null, bestMinDist = 0;
            for (let attempt = 0; attempt < 50; attempt++) {
                // 원형 영역 내 랜덤 위치
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * (this.currentRadius - padding);
                const pos = {
                    x: this.centerX + Math.cos(angle) * dist,
                    y: this.centerY + Math.sin(angle) * dist
                };
                let minDistToOthers = Infinity;
                for (const other of positions) {
                    const dx = pos.x - other.x, dy = pos.y - other.y;
                    minDistToOthers = Math.min(minDistToOthers, Math.sqrt(dx*dx + dy*dy));
                }
                if (minDistToOthers > bestMinDist) { bestMinDist = minDistToOthers; bestPos = pos; }
                if (minDistToOthers >= 50) break;
            }
            positions.push(bestPos || { 
                x: this.centerX + (Math.random() - 0.5) * this.currentRadius,
                y: this.centerY + (Math.random() - 0.5) * this.currentRadius
            });
        }
        return positions;
    }
    
    start() {
        if (this.participants.length < 2) { 
            alert('최소 2명 이상의 참여자가 필요합니다!'); 
            return; 
        }
        this.reset();
        this.isRunning = true;
        this.startTime = Date.now();
        this.endTime = 0;
        this.setControlsDisabled(true);
        this.gameLoop();
    }
    
    stop() { 
        this.isRunning = false; 
        this.setControlsDisabled(false); 
    }
    
    setControlsDisabled(disabled) {
        document.getElementById('zombieCount').disabled = disabled;
        document.getElementById('survivorCount').disabled = disabled;
    }
    
    gameLoop() {
        if (!this.isRunning) return;
        
        this.update();
        this.draw();
        this.updateUI();
        
        const humans = this.entities.filter(e => !e.isZombie && !e.isTransforming);
        if (humans.length <= this.survivorCount && this.isRunning) {
            this.endGame(humans);
            return;
        }
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    update() {
        this.updateShrinking();
        this.updateTransformations();
        
        const humans = this.entities.filter(e => !e.isZombie && !e.isTransforming);
        const zombies = this.entities.filter(e => e.isZombie);
        
        for (const entity of this.entities) {
            if (entity.isTransforming) continue;
            
            // 먹는 중인 좀비는 움직이지 않음
            if (entity.eatingTimer > 0) {
                entity.eatingTimer--;
                entity.vx = 0;
                entity.vy = 0;
                continue;
            }
            
            if (entity.isZombie) this.updateZombie(entity, humans);
            else this.updateHuman(entity, zombies);
            
            entity.x += entity.vx; 
            entity.y += entity.vy;
            entity.vx *= 0.95; 
            entity.vy *= 0.95;
            
            // 원형 경계 충돌
            const dx = entity.x - this.centerX;
            const dy = entity.y - this.centerY;
            const distFromCenter = Math.sqrt(dx * dx + dy * dy);
            const maxDist = this.currentRadius - this.entityRadius;
            
            if (distFromCenter > maxDist) {
                const angle = Math.atan2(dy, dx);
                entity.x = this.centerX + Math.cos(angle) * maxDist;
                entity.y = this.centerY + Math.sin(angle) * maxDist;
                
                // 반사
                const normalX = dx / distFromCenter;
                const normalY = dy / distFromCenter;
                const dot = entity.vx * normalX + entity.vy * normalY;
                entity.vx -= 2 * dot * normalX * 0.5;
                entity.vy -= 2 * dot * normalY * 0.5;
            }
            
            // 영역 밖 데미지
            if (!entity.isZombie && distFromCenter > this.currentRadius) {
                entity.health -= 0.5;
                if (entity.health <= 0) {
                    this.startTransformation(entity, '영역 이탈');
                }
            }
        }
        
        this.checkInfections(humans, zombies);
        this.handleCollisions();
    }
    
    updateTransformations() {
        for (const entity of this.entities) {
            if (entity.isTransforming) {
                entity.transformTimer--;
                if (entity.transformTimer <= 0) {
                    entity.isTransforming = false;
                    entity.isZombie = true;
                    entity.color = '#666';
                    entity.hasTarget = false;
                    entity.wanderTimer = 60;
                }
            }
        }
    }
    
    startTransformation(entity, cause, infector = null) {
        if (entity.isTransforming || entity.isZombie) return;
        
        entity.isTransforming = true;
        entity.transformTimer = 60;
        entity.vx = 0;
        entity.vy = 0;
        
        // 감염시킨 좀비는 0.5초 멈춤 (먹는 시간)
        if (infector) {
            infector.eatingTimer = 30; // 0.5초
            infector.vx = 0;
            infector.vy = 0;
        }
        
        this.infectedOrder.push({ 
            name: entity.name, 
            time: Date.now() - this.startTime, 
            cause: cause 
        });
        this.updateRanking();
    }
    
    updateShrinking() {
        this.shrinkTimer++;
        const warning = document.getElementById('shrinkWarning');
        
        if (this.shrinkTimer > this.shrinkInterval - this.shrinkWarningTime && this.shrinkTimer < this.shrinkInterval) {
            warning.style.display = 'block';
        } else {
            warning.style.display = 'none';
        }
        
        if (this.shrinkTimer >= this.shrinkInterval) {
            this.shrinkTimer = 0;
            this.shrinkPhase++;
            
            // 랜덤 중심점 선택 (현재 영역 내)
            const maxOffset = this.currentRadius * 0.3;
            const offsetAngle = Math.random() * Math.PI * 2;
            const offsetDist = Math.random() * maxOffset;
            
            this.targetCenterX = this.centerX + Math.cos(offsetAngle) * offsetDist;
            this.targetCenterY = this.centerY + Math.sin(offsetAngle) * offsetDist;
            
            // 캔버스 경계 내로 제한
            const minRadius = Math.min(50, this.currentRadius * 0.5);
            const shrinkAmount = Math.min(30 + this.shrinkPhase * 15, this.currentRadius * 0.3);
            this.targetRadius = Math.max(minRadius, this.currentRadius - shrinkAmount);
            
            // 새 중심이 경계를 벗어나지 않도록 조정
            const margin = this.targetRadius + 10;
            this.targetCenterX = Math.max(margin, Math.min(this.canvas.width - margin, this.targetCenterX));
            this.targetCenterY = Math.max(margin, Math.min(this.canvas.height - margin, this.targetCenterY));
            
            this.isShrinking = true;
        }
        
        if (this.isShrinking) {
            const speed = 0.016; // 0.8배 느리게 (0.02 * 0.8)
            this.centerX += (this.targetCenterX - this.centerX) * speed;
            this.centerY += (this.targetCenterY - this.centerY) * speed;
            this.currentRadius += (this.targetRadius - this.currentRadius) * speed;
            
            if (Math.abs(this.currentRadius - this.targetRadius) < 1) {
                this.currentRadius = this.targetRadius;
                this.centerX = this.targetCenterX;
                this.centerY = this.targetCenterY;
                this.isShrinking = false;
            }
        }
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
            if (dist < this.detectRange && this.isInFieldOfView(zombie, human, this.zombieFovAngle)) {
                if (dist < closestVisibleDist) { 
                    closestVisibleDist = dist; 
                    closestVisible = human; 
                }
            }
        }
        
        if (closestVisible) {
            zombie.hasTarget = true;
            const dx = closestVisible.x - zombie.x, dy = closestVisible.y - zombie.y;
            const targetAngle = Math.atan2(dy, dx);
            let angleDiff = targetAngle - zombie.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            zombie.angle += angleDiff * 0.12;
            zombie.vx = Math.cos(zombie.angle) * this.zombieChaseSpeed;
            zombie.vy = Math.sin(zombie.angle) * this.zombieChaseSpeed;
        } else {
            zombie.hasTarget = false;
            zombie.wanderTimer--;
            if (zombie.wanderTimer <= 0) { 
                zombie.targetAngle = Math.random() * Math.PI * 2; 
                zombie.wanderTimer = 60 + Math.random() * 120; 
            }
            let angleDiff = zombie.targetAngle - zombie.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            zombie.angle += angleDiff * 0.03;
            zombie.vx = Math.cos(zombie.angle) * this.zombieWalkSpeed;
            zombie.vy = Math.sin(zombie.angle) * this.zombieWalkSpeed;
        }
    }
    
    updateHuman(human, zombies) {
        if (human.runTimer > 0) human.runTimer--;
        
        let nearestVisibleZombie = null, nearestDist = Infinity;
        for (const zombie of zombies) {
            const dx = zombie.x - human.x, dy = zombie.y - human.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < this.detectRange && this.isInFieldOfView(human, zombie, this.humanFovAngle)) {
                if (dist < nearestDist) { 
                    nearestDist = dist; 
                    nearestVisibleZombie = zombie; 
                }
            }
        }
        
        if (nearestVisibleZombie) {
            const dx = human.x - nearestVisibleZombie.x;
            const dy = human.y - nearestVisibleZombie.y;
            human.angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.3;
            human.runTimer = this.runDuration;
            human.isRunning = true;
        }
        
        if (human.runTimer > 0) {
            human.isRunning = true;
            human.vx = Math.cos(human.angle) * this.humanRunSpeed;
            human.vy = Math.sin(human.angle) * this.humanRunSpeed;
        } else {
            human.isRunning = false;
            human.wanderTimer--;
            if (human.wanderTimer <= 0) { 
                human.targetAngle = Math.random() * Math.PI * 2; 
                human.wanderTimer = 60 + Math.random() * 120; 
            }
            let angleDiff = human.targetAngle - human.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            human.angle += angleDiff * 0.04;
            human.vx = Math.cos(human.angle) * this.humanWalkSpeed;
            human.vy = Math.sin(human.angle) * this.humanWalkSpeed;
        }
    }
    
    checkInfections(humans, zombies) {
        for (const human of humans) {
            for (const zombie of zombies) {
                if (zombie.eatingTimer > 0) continue; // 먹는 중인 좀비는 감염 안 시킴
                
                const dx = human.x - zombie.x, dy = human.y - zombie.y;
                if (Math.sqrt(dx*dx + dy*dy) < this.entityRadius * 2.2) {
                    this.startTransformation(human, '감염', zombie);
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
                const minDist = this.entityRadius * 2.2;
                
                if (dist < minDist && dist > 0) {
                    const overlap = (minDist - dist) / 2;
                    const nx = dx / dist, ny = dy / dist;
                    a.x -= nx * overlap * 0.5; 
                    a.y -= ny * overlap * 0.5;
                    b.x += nx * overlap * 0.5; 
                    b.y += ny * overlap * 0.5;
                }
            }
        }
    }
    
    draw() {
        const ctx = this.ctx;
        ctx.fillStyle = '#0a0f0a';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 위험 영역 (전체 화면)
        ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 안전 영역 (원형)
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#111a11';
        ctx.fill();
        
        // 그리드 (원형 클리핑)
        ctx.clip();
        ctx.strokeStyle = 'rgba(100, 255, 100, 0.08)';
        ctx.lineWidth = 1;
        for (let x = 0; x < this.canvas.width; x += 40) { 
            ctx.beginPath(); 
            ctx.moveTo(x, 0); 
            ctx.lineTo(x, this.canvas.height); 
            ctx.stroke(); 
        }
        for (let y = 0; y < this.canvas.height; y += 40) { 
            ctx.beginPath(); 
            ctx.moveTo(0, y); 
            ctx.lineTo(this.canvas.width, y); 
            ctx.stroke(); 
        }
        ctx.restore();
        
        // 원형 테두리
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, this.currentRadius, 0, Math.PI * 2);
        ctx.strokeStyle = this.isShrinking ? '#ff4444' : 'rgba(100, 255, 100, 0.5)';
        ctx.lineWidth = this.isShrinking ? 4 : 2;
        ctx.stroke();
        
        // 다음 영역 미리보기
        if (this.shrinkTimer > this.shrinkInterval - this.shrinkWarningTime) {
            ctx.beginPath();
            ctx.arc(this.targetCenterX, this.targetCenterY, this.targetRadius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        // 엔티티
        const humans = this.entities.filter(e => !e.isZombie);
        const zombies = this.entities.filter(e => e.isZombie);
        for (const e of humans) this.drawEntity(e);
        for (const e of zombies) this.drawEntity(e);
    }
    
    drawEntity(entity) {
        const ctx = this.ctx, x = entity.x, y = entity.y, r = this.entityRadius;
        
        ctx.save();
        ctx.translate(x, y);
        
        // 변환 애니메이션
        if (entity.isTransforming) {
            const progress = 1 - (entity.transformTimer / 60);
            const pulseScale = 1 + Math.sin(progress * Math.PI * 6) * 0.2;
            ctx.scale(pulseScale, pulseScale);
            
            const greenToRed = Math.floor(progress * 255);
            ctx.fillStyle = `rgb(${100 + greenToRed}, ${150 - greenToRed * 0.5}, ${100 - greenToRed * 0.3})`;
            
            const shake = (1 - progress) * 3;
            ctx.translate(Math.random() * shake - shake/2, Math.random() * shake - shake/2);
            
            ctx.beginPath(); 
            ctx.ellipse(0, 0, r, r * 0.7, 0, 0, Math.PI * 2); 
            ctx.fill();
            
            ctx.fillStyle = `rgb(${150 + greenToRed * 0.4}, ${180 - greenToRed * 0.5}, ${150 - greenToRed * 0.4})`;
            ctx.beginPath(); 
            ctx.arc(r * 0.35, 0, r * 0.35, 0, Math.PI * 2); 
            ctx.fill();
            
            ctx.strokeStyle = `rgba(255, ${255 - greenToRed}, 0, ${0.8 - progress * 0.5})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, r + 8 + progress * 5, 0, Math.PI * 2 * progress);
            ctx.stroke();
            
            ctx.restore();
            
            ctx.font = 'bold ' + Math.max(12, r * 1.2) + 'px "Noto Sans KR"';
            ctx.textAlign = 'center'; 
            ctx.textBaseline = 'top';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)'; 
            ctx.lineWidth = 3;
            ctx.strokeText('🧟' + entity.name, x, y + r + 5);
            ctx.fillStyle = '#ffaa00';
            ctx.fillText('🧟' + entity.name, x, y + r + 5);
            return;
        }
        
        if (entity.isZombie) {
            // 먹는 중 표시
            if (entity.eatingTimer > 0) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                ctx.beginPath();
                ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
                ctx.fill();
            }
            
            if (!entity.hasTarget && entity.eatingTimer <= 0) {
                ctx.rotate(entity.angle);
                const fovRad = (this.zombieFovAngle / 2) * (Math.PI / 180);
                ctx.fillStyle = 'rgba(255, 50, 50, 0.08)';
                ctx.beginPath(); 
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, this.detectRange, -fovRad, fovRad);
                ctx.closePath(); 
                ctx.fill();
                ctx.rotate(-entity.angle);
            }
            
            ctx.rotate(entity.angle);
            ctx.fillStyle = '#4a5d4a';
            ctx.beginPath(); 
            ctx.ellipse(0, 0, r, r * 0.7, 0, 0, Math.PI * 2); 
            ctx.fill();
            ctx.fillStyle = '#5a6b5a';
            ctx.beginPath(); 
            ctx.arc(r * 0.4, 0, r * 0.4, 0, Math.PI * 2); 
            ctx.fill();
            ctx.fillStyle = entity.hasTarget ? '#ff0000' : '#ff4444';
            ctx.beginPath(); 
            ctx.arc(r * 0.5, -r * 0.1, r * 0.1, 0, Math.PI * 2); 
            ctx.arc(r * 0.5, r * 0.1, r * 0.1, 0, Math.PI * 2); 
            ctx.fill();
        } else {
            ctx.rotate(entity.angle);
            const fovRad = (this.humanFovAngle / 2) * (Math.PI / 180);
            ctx.fillStyle = 'rgba(255, 255, 100, 0.05)';
            ctx.beginPath(); 
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, this.detectRange, -fovRad, fovRad);
            ctx.closePath(); 
            ctx.fill();
            
            ctx.fillStyle = entity.color;
            ctx.beginPath(); 
            ctx.ellipse(0, 0, r, r * 0.65, 0, 0, Math.PI * 2); 
            ctx.fill();
            ctx.fillStyle = '#FFDAB9';
            ctx.beginPath(); 
            ctx.arc(r * 0.35, 0, r * 0.35, 0, Math.PI * 2); 
            ctx.fill();
            ctx.fillStyle = '#333';
            ctx.beginPath(); 
            ctx.arc(r * 0.25, 0, r * 0.3, Math.PI * 0.7, -Math.PI * 0.7); 
            ctx.fill();
            
            if (entity.isRunning) {
                ctx.rotate(-entity.angle);
                ctx.strokeStyle = '#ffff00';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, r + 3, 0, Math.PI * 2 * (entity.runTimer / this.runDuration));
                ctx.stroke();
            }
        }
        
        ctx.restore();
        
        // 이름
        ctx.font = 'bold ' + Math.max(12, r * 1.2) + 'px "Noto Sans KR"';
        ctx.textAlign = 'center'; 
        ctx.textBaseline = 'top';
        const shortName = entity.name.length > 6 ? entity.name.slice(0, 5) + '..' : entity.name;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)'; 
        ctx.lineWidth = 3;
        ctx.strokeText(shortName, x, y + r + 5);
        ctx.fillStyle = entity.isZombie ? '#ff6666' : '#fff';
        ctx.fillText(shortName, x, y + r + 5);
        
        // 체력바
        if (!entity.isZombie && entity.health < 100) {
            const barW = r * 1.5, barH = 3, barY = -r - 6;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(x - barW/2, y + barY, barW, barH);
            ctx.fillStyle = entity.health > 50 ? '#4CAF50' : entity.health > 25 ? '#ff9800' : '#f44336';
            ctx.fillRect(x - barW/2, y + barY, barW * (entity.health / 100), barH);
        }
    }
    
    endGame(winners) {
        this.isRunning = false;
        this.endTime = Date.now(); // 종료 시간 저장
        this.setControlsDisabled(false);
        document.getElementById('shrinkWarning').style.display = 'none';
        
        if (winners && winners.length > 0) {
            const survivalTime = ((this.endTime - this.startTime) / 1000).toFixed(1);
            const winnerNames = winners.map(w => w.name).join(', ');
            document.getElementById('winnerName').textContent = winnerNames;
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
        
        const survivors = this.entities.filter(e => !e.isZombie && !e.isTransforming);
        survivors.forEach(survivor => {
            const isWinner = survivors.length <= this.survivorCount;
            html += '<div class="ranking-item ' + (isWinner ? 'winner' : 'survivor') + '"><span class="ranking-rank">' + (isWinner ? '🏆' : '🧑') + '</span><span class="ranking-name">' + survivor.name + '</span><span class="ranking-status">' + (isWinner ? '승리!' : '생존') + '</span></div>';
        });
        
        const initialZombies = this.entities.filter(e => e.isInitialZombie);
        if (initialZombies.length > 0) {
            html += '<div style="border-top: 1px solid rgba(255,255,255,0.1); margin: 6px 0; padding-top: 6px; font-size: 0.6rem; color: #666;">초기 좀비</div>';
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
        
        if (this.isRunning) {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const seconds = (elapsed % 60).toString().padStart(2, '0');
            document.getElementById('timerDisplay').textContent = minutes + ':' + seconds;
        }
    }
    
    getResultText() {
        // 게임 종료 시간 사용 (종료 안 됐으면 현재 시간)
        const endTimeToUse = this.endTime || Date.now();
        const elapsed = this.startTime ? ((endTimeToUse - this.startTime) / 1000).toFixed(1) : 0;
        
        let result = '🧟 좀비 추첨 결과 🧟\n';
        result += '━━━━━━━━━━━━━━\n';
        result += '⏱️ 게임 시간: ' + elapsed + '초\n\n';
        
        const survivors = this.entities.filter(e => !e.isZombie && !e.isTransforming);
        if (survivors.length > 0) {
            result += '🏆 최종 생존자\n';
            survivors.forEach(s => {
                result += '   ' + s.name + '\n';
            });
            result += '\n';
        }
        
        if (this.infectedOrder.length > 0) {
            result += '💀 감염 순서\n';
            this.infectedOrder.forEach((infected, idx) => {
                const time = (infected.time / 1000).toFixed(1);
                result += '   ' + (idx + 1) + '. ' + infected.name + ' (' + time + 's)\n';
            });
        }
        
        result += '\n🎮 https://github.com/geniuskey/zombie-arena';
        return result;
    }
}

// Toast notification
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const game = new ZombieSurvival(canvas);
    
    const participantsInput = document.getElementById('participants');
    const zombieCountSlider = document.getElementById('zombieCount');
    const zombieValueDisplay = document.getElementById('zombieValue');
    const survivorCountSlider = document.getElementById('survivorCount');
    const survivorValueDisplay = document.getElementById('survivorValue');
    const startBtn = document.getElementById('startBtn');
    const resetBtn = document.getElementById('resetBtn');
    const helpBtn = document.getElementById('helpBtn');
    const helpModal = document.getElementById('helpModal');
    const closeHelpBtn = document.getElementById('closeHelpBtn');
    const winnerOverlay = document.getElementById('winnerOverlay');
    const closeWinnerBtn = document.getElementById('closeWinnerBtn');
    const copyResultBtn = document.getElementById('copyResultBtn');
    
    function parseParticipants(text) { 
        return text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean); 
    }
    
    function updateGame() { 
        game.setParticipants(parseParticipants(participantsInput.value)); 
    }
    
    participantsInput.addEventListener('input', updateGame);
    
    zombieCountSlider.addEventListener('input', () => {
        zombieValueDisplay.textContent = zombieCountSlider.value;
        game.zombieCount = parseInt(zombieCountSlider.value);
        if (!game.isRunning) game.reset();
    });
    
    survivorCountSlider.addEventListener('input', () => {
        survivorValueDisplay.textContent = survivorCountSlider.value;
        game.survivorCount = parseInt(survivorCountSlider.value);
    });
    
    startBtn.addEventListener('click', () => {
        const participants = parseParticipants(participantsInput.value);
        if (participants.length < 2) { 
            alert('최소 2명 이상의 참여자가 필요합니다!'); 
            return; 
        }
        if (game.survivorCount >= participants.length) { 
            alert('최종 생존자 수는 참여자 수보다 적어야 합니다!'); 
            return; 
        }
        game.setParticipants(participants);
        game.start();
    });
    
    resetBtn.addEventListener('click', () => { 
        game.stop(); 
        game.reset(); 
    });
    
    helpBtn.addEventListener('click', () => helpModal.classList.add('show'));
    closeHelpBtn.addEventListener('click', () => helpModal.classList.remove('show'));
    helpModal.addEventListener('click', (e) => { 
        if (e.target === helpModal) helpModal.classList.remove('show'); 
    });
    
    closeWinnerBtn.addEventListener('click', () => winnerOverlay.classList.remove('show'));
    
    copyResultBtn.addEventListener('click', () => {
        const resultText = game.getResultText();
        navigator.clipboard.writeText(resultText).then(() => {
            showToast('📋 결과가 복사되었습니다!');
        }).catch(() => {
            showToast('❌ 복사 실패');
        });
    });
    
    // Load saved participants
    const saved = localStorage.getItem('zombie-lottery-participants');
    if (saved) { 
        participantsInput.value = saved; 
        updateGame(); 
    }
    
    participantsInput.addEventListener('input', () => {
        localStorage.setItem('zombie-lottery-participants', participantsInput.value);
    });
    
    game.draw();
});
