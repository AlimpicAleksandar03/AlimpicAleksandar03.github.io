const trigger = document.querySelector(".trigger");
const body = document.querySelector("body");
const close = document.querySelector(".close");
trigger.addEventListener("click", addClass);
function addClass() {
  body.classList.toggle("is-menu-visible");
}
close.addEventListener("click", removeClass);
function removeClass() {
  body.classList.remove("is-menu-visible");
}
