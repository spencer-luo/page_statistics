type HashFn = (input: string) => number;

class SetCounter
{
    // private hashFn: HashFn;
    private container: Set<number>;
    // hashFn: HashFn
    constructor()
    {
        // this.hashFn = hashFn;
        this.container = new Set();
    }

    add(value: number)
    {
        this.container.add(value)
    }

    count()
    {
        return this.container.size;
    }

    valueList(): Array<number> {
        return Array.from(this.container);
    }

    toJson(): Record<string, any> {
        return Array.from(this.container);
    }

    fromJson(data: number[])
    {
        this.container = new Set(data);
    }
}

export default SetCounter;