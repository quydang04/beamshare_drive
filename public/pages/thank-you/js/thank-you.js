(function () {
    const canvas = document.getElementById('confetti-canvas');
    const messageElement = document.getElementById('thankyou-message');
    const planHighlight = document.getElementById('plan-highlight');
    const badge = document.querySelector('.badge');
    const highlightLabel = planHighlight ? planHighlight.querySelector('.highlight-label') : null;
    const highlightDescription = planHighlight ? planHighlight.querySelector('p') : null;
    const paymentStatusLabel = document.getElementById('payment-status-label');
    const planNameElement = document.getElementById('plan-name');
    const statusIcon = document.querySelector('.status-icon');
    const body = document.body;

    const params = new URLSearchParams(window.location.search);
    const paymentStatus = (params.get('paymentStatus') || 'success').toLowerCase();
    const messageParam = params.get('message');
    const planParam = (params.get('plan') || 'premium').toLowerCase();

    function getPlanCopy(plan) {
        if (plan === 'premium') {
            return {
                label: 'BeamShare Premium',
                description: 'Không giới hạn BeamShare Live, dung lượng mở rộng và hỗ trợ ưu tiên.'
            };
        }
        if (plan === 'basic') {
            return {
                label: 'BeamShare Basic',
                description: 'Tiếp tục trải nghiệm BeamShare cùng giới hạn 200MB mỗi file gửi.'
            };
        }
        return {
            label: 'BeamShare',
            description: 'Trải nghiệm chia sẻ file tức thì giữa các thiết bị của bạn.'
        };
    }

    function setStatusIcon(isSuccess) {
        if (!statusIcon) {
            return;
        }

        const successIcon = '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M12 22c5.522 0 10-4.477 10-10S17.522 2 12 2 2 6.477 2 12s4.478 10 10 10Zm0-2a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm-1.293-4.707 5.364-5.364a1 1 0 1 0-1.414-1.414l-4.657 4.657-2.071-2.071a1 1 0 1 0-1.414 1.414l2.778 2.778a1 1 0 0 0 1.414 0Z"></path></svg>';
        const pendingIcon = '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M12 22a10 10 0 1 0-9.543-13.1 1 1 0 0 0 1.9.63A8 8 0 1 1 4 12v.25a1 1 0 0 0 .553.894l5.697 2.849A1 1 0 0 0 12 15.1V9a1 1 0 0 1 2 0v7.382a1 1 0 0 1-1.447.894L8.5 15.382v.118a3.5 3.5 0 1 0 6.7 1.382 1 1 0 1 1 1.894.632A5.5 5.5 0 1 1 8 16.63v-1.512L5 13.63V13a7 7 0 1 1 7 7 1 1 0 0 1 0-2Z"></path></svg>';

        statusIcon.innerHTML = isSuccess ? successIcon : pendingIcon;
    }

    function hydrateCopy() {
        const planCopy = getPlanCopy(planParam);
        const isSuccess = paymentStatus === 'success';

        if (messageElement) {
            if (messageParam) {
                messageElement.textContent = messageParam;
            } else {
                messageElement.textContent = isSuccess
                    ? 'Giao dịch của bạn đã được xác nhận. Chúc bạn có trải nghiệm tuyệt vời cùng BeamShare.'
                    : 'Chúng tôi chưa thể xác nhận giao dịch. Vui lòng kiểm tra lại trạng thái thanh toán hoặc liên hệ hỗ trợ.';
            }
        }

        if (badge) {
            badge.textContent = isSuccess ? 'Thanh toán thành công' : 'Cập nhật thanh toán';
        }

        if (highlightLabel) {
            highlightLabel.textContent = planCopy.label;
        }

        if (highlightDescription) {
            highlightDescription.textContent = planCopy.description;
        }

        if (planNameElement) {
            planNameElement.textContent = planCopy.label;
        }

        if (paymentStatusLabel) {
            paymentStatusLabel.textContent = isSuccess ? 'Hoàn tất' : 'Đang chờ xác nhận';
            paymentStatusLabel.classList.toggle('is-warning', !isSuccess);
        }

        if (planHighlight) {
            planHighlight.classList.toggle('is-muted', !isSuccess);
        }

        if (body && body.classList.contains('thank-you-page')) {
            body.classList.toggle('is-pending', !isSuccess);
        }

        setStatusIcon(isSuccess);

        document.title = isSuccess
            ? 'BeamShare Drive | Cảm ơn bạn!'
            : 'BeamShare Drive | Cập nhật thanh toán';
    }

    // Confetti animation
    if (!canvas) {
        return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
        return;
    }
    let confettiPieces = [];
    let animationFrame;

    const COLORS = [
        '#ff7a18', '#ffb347', '#5ee7df', '#b490ca', '#f45c43', '#76b852', '#fc466b'
    ];

    function resizeCanvas() {
        const { innerWidth, innerHeight } = window;
        const ratio = window.devicePixelRatio || 1;
        canvas.width = innerWidth * ratio;
        canvas.height = innerHeight * ratio;
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.scale(ratio, ratio);
    }

    function createPiece() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        return {
            x: Math.random() * width,
            y: Math.random() * -height,
            rotation: Math.random() * 360,
            size: Math.random() * 14 + 8,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            speed: Math.random() * 4 + 3,
            drift: Math.random() * 1 - 0.5,
            tilt: Math.random() * 10,
            tiltAngle: 0,
            opacity: Math.random() * 0.6 + 0.4
        };
    }

    function initializeConfetti(count = 180) {
        confettiPieces = new Array(count).fill(null).map(createPiece);
    }

    function drawPiece(piece) {
        context.beginPath();
        context.fillStyle = piece.color;
        context.globalAlpha = piece.opacity;
        context.moveTo(piece.x + piece.tilt + piece.size / 2, piece.y);
        context.lineTo(piece.x + piece.tilt, piece.y + piece.size);
        context.lineTo(piece.x + piece.tilt + piece.size, piece.y + piece.size);
        context.closePath();
        context.fill();
    }

    function updatePiece(piece, index) {
        piece.y += piece.speed;
        piece.x += piece.drift;
        piece.tiltAngle += 0.02;
        piece.tilt = Math.sin(piece.tiltAngle) * 12;

        if (piece.y > window.innerHeight + piece.size) {
            confettiPieces[index] = createPiece();
            confettiPieces[index].y = -10;
        }
    }

    function renderConfetti() {
        context.clearRect(0, 0, window.innerWidth, window.innerHeight);
        confettiPieces.forEach((piece, index) => {
            drawPiece(piece);
            updatePiece(piece, index);
        });
        animationFrame = requestAnimationFrame(renderConfetti);
    }

    function startConfetti() {
        resizeCanvas();
        initializeConfetti();
        renderConfetti();
    }

    function stopConfetti() {
        cancelAnimationFrame(animationFrame);
        context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }

    window.addEventListener('resize', () => {
        resizeCanvas();
    });

    hydrateCopy();

    if (paymentStatus === 'success') {
        startConfetti();
    } else {
        stopConfetti();
    }
})();
