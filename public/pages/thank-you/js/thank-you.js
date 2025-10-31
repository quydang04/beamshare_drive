(function () {
    const canvas = document.getElementById('confetti-canvas');
    const messageElement = document.getElementById('thankyou-message');
    const planHighlight = document.getElementById('plan-highlight');
    const badge = document.querySelector('.badge');
    const highlightLabel = planHighlight ? planHighlight.querySelector('.highlight-label') : null;
    const highlightDescription = planHighlight ? planHighlight.querySelector('p') : null;

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

    function hydrateCopy() {
        const planCopy = getPlanCopy(planParam);

        if (messageElement) {
            if (messageParam) {
                messageElement.textContent = messageParam;
            } else {
                messageElement.textContent = paymentStatus === 'success'
                    ? 'Giao dịch của bạn đã được xác nhận. Chúc bạn có trải nghiệm tuyệt vời cùng BeamShare.'
                    : 'Chúng tôi chưa thể xác nhận giao dịch. Vui lòng kiểm tra lại trạng thái thanh toán hoặc liên hệ hỗ trợ.';
            }
        }

        if (badge) {
            badge.textContent = paymentStatus === 'success' ? 'Thanh toán thành công' : 'Cập nhật thanh toán';
        }

        if (highlightLabel) {
            highlightLabel.textContent = planCopy.label;
        }

        if (highlightDescription) {
            highlightDescription.textContent = planCopy.description;
        }

        if (paymentStatus !== 'success' && planHighlight) {
            planHighlight.classList.add('is-muted');
        }

        if (paymentStatus === 'success') {
            document.title = 'BeamShare Drive | Cảm ơn bạn!';
        } else {
            document.title = 'BeamShare Drive | Cập nhật thanh toán';
        }
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
