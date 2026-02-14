const year = new Date().getFullYear();
const footer = document.querySelector('.footer .brand');
if (footer) {
  footer.setAttribute('aria-label', `Physics Mentor © ${year}`);
}

const problemCards = document.querySelectorAll('.practice-card');

problemCards.forEach((card) => {
  const button = card.querySelector('.check-answer');
  const input = card.querySelector('input');
  const feedback = card.querySelector('.feedback');
  const expected = Number(card.dataset.answer);
  const unit = card.dataset.unit;

  button?.addEventListener('click', () => {
    const submitted = Number(input.value);

    if (Number.isNaN(submitted)) {
      feedback.textContent = 'Enter a numeric answer to get feedback.';
      feedback.classList.add('incorrect');
      feedback.classList.remove('correct');
      return;
    }

    const tolerance = Math.max(0.01, Math.abs(expected) * 0.02);
    const isCorrect = Math.abs(submitted - expected) <= tolerance;

    if (isCorrect) {
      feedback.textContent = `Nice work. ${submitted} ${unit} is correct.`;
      feedback.classList.add('correct');
      feedback.classList.remove('incorrect');
    } else {
      feedback.textContent = `Not quite. Review the model and try again (target: ${expected} ${unit}).`;
      feedback.classList.add('incorrect');
      feedback.classList.remove('correct');
    }
  });
});
