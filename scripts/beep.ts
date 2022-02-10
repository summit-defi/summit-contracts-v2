const delay = async (ms: number) => {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

const main = async () => {
    console.log("\x07");
    await delay(200)
    console.log("\x07");
    await delay(200)
    console.log("\x07");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });