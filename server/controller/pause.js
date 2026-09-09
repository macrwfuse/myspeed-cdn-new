let currentStateVar = false;
let updateTimer;

export const updateState = (newState) => {
    currentStateVar = newState;
}

export const resumeIn = (hours) => {
    if (/[^0-9]/.test(hours)) return false;


    if (updateTimer !== null) 
        clearTimeout(updateTimer);

    updateState(true);
    updateTimer = setTimeout(() => updateState(false), hours * 3600000); // time in hours

    return true;
}

export { currentStateVar as currentState };